import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { getQuotaWindowEnd, getQuotaWindowStart } from "../../../lib/quotaWindow"
import { getAccountUserIds, getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16"
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LIMITS: Record<string, number> = {
  pro: 40,
  basic: 15,
  trial: 15,
}

export async function GET(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  if (authUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const billingDecision = await getBillingAccessDecision(authUser.id)
  if (!billingDecision.allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const ownerId = billingDecision.ownerId!
  const plan = billingDecision.billingProfile?.plan || "basic"
  let ownerSubscriptionStartedAt = billingDecision.billingProfile?.subscription_started_at ?? null

  // Backfill subscription_started_at for subscribed users where it's missing
  if (!ownerSubscriptionStartedAt && billingDecision.billingProfile?.subscribed) {
    try {
      const { data: subRow } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", ownerId)
        .eq("status", "active")
        .maybeSingle()

      if (subRow?.stripe_subscription_id) {
        const stripeSub = await stripe.subscriptions.retrieve(subRow.stripe_subscription_id)
        // Intentionally use current_period_start so quota resets align to the current billing period.
        const periodStart = new Date(stripeSub.current_period_start * 1000).toISOString()
        // Use immediately for this response even if write-back fails.
        ownerSubscriptionStartedAt = periodStart
        // Write back so future requests skip this fetch
        const { error: profileBackfillError } = await supabaseAdmin
          .from("profiles")
          .update({ subscription_started_at: periodStart })
          .eq("id", ownerId)
        if (profileBackfillError) {
          console.warn("subscription_started_at profile write failed (non-fatal):", profileBackfillError)
        }
      }
    } catch (backfillErr) {
      console.warn("subscription_started_at backfill failed (non-fatal):", backfillErr)
    }
  }

  const limit = PLAN_LIMITS[plan] ?? 15

  // Collect all user IDs in this account (owner + sub-users)
  const accountUserIds = await getAccountUserIds(ownerId)

  // Count URLs added since the start of the current quota period across the whole account,
  // excluding those with ONLY failed captures (same logic as add-url/route.ts)
  const quotaWindowStart = getQuotaWindowStart(ownerSubscriptionStartedAt)
  const quotaWindowEnd = getQuotaWindowEnd(ownerSubscriptionStartedAt)

  const { data: recentUrls } = await supabaseAdmin
    .from("urls")
    .select("id")
    .in("user_id", accountUserIds)
    .gte("created_at", quotaWindowStart.toISOString())

  const recentUrlIds = (recentUrls || []).map((u: any) => u.id)
  let urlCount = 0

  if (recentUrlIds.length > 0) {
    const { data: successCaptures } = await supabaseAdmin
      .from("captures")
      .select("url_id")
      .in("url_id", recentUrlIds)
      .eq("status", "success")

    const successfulUrlIds = new Set((successCaptures || []).map((c: any) => c.url_id))

    const { data: failedCaptures } = await supabaseAdmin
      .from("captures")
      .select("url_id")
      .in("url_id", recentUrlIds)
      .eq("status", "failed")

    const failedUrlIds = new Set((failedCaptures || []).map((c: any) => c.url_id))

    urlCount = recentUrlIds.filter((id: string) => {
      const hasSuccess = successfulUrlIds.has(id)
      const hasFailed = failedUrlIds.has(id)
      const isPending = !hasSuccess && !hasFailed
      return hasSuccess || isPending
    }).length
  }

  return NextResponse.json({ urlCount, plan, limit, quotaResetAt: quotaWindowEnd?.toISOString() ?? null })
}
