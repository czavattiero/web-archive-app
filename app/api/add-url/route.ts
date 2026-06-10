import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getQuotaWindowStart } from "../../../lib/quotaWindow"
import { getAccountUserIds, getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"
import { sanitizeLabel } from "../../../lib/labelUtils"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LIMITS: Record<string, number> = {
  pro: 40,
  basic: 15,
  trial: 15,
  enterprise: Infinity,
}

export async function POST(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { userId, url, schedule_type, schedule_value, next_capture_at, label } = body

  if (!userId || !url) {
    return NextResponse.json({ error: "userId and url are required" }, { status: 400 })
  }

  if (authUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const billingDecision = await getBillingAccessDecision(authUser.id)
  if (!billingDecision.allowed) {
    if (billingDecision.reason === "trial_expired") {
      return NextResponse.json(
        { error: "The account's free trial has expired. Please choose a plan to continue.", trialExpired: true },
        { status: 403 }
      )
    }
    if (billingDecision.reason === "payment_required") {
      return NextResponse.json(
        { error: "Payment required. Please complete your subscription to add URLs.", paymentRequired: true },
        { status: 403 }
      )
    }
    if (billingDecision.reason === "profile_not_found") {
      console.warn("⚠️ add-url blocked by missing profile after billing check", {
        userId: authUser.id,
        reason: billingDecision.reason,
      })
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      )
    }
    // Defensive fallback if new denial reasons are added in billingAccess.
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const ownerId: string = billingDecision.ownerId!
  const planProfile = billingDecision.billingProfile
  const plan: string = planProfile?.plan || "basic"

  const limit = PLAN_LIMITS[plan] ?? 15

  // Collect all user IDs in this account (owner + sub-users) for shared quota
  const accountUserIds = await getAccountUserIds(ownerId)

  // Count URLs added since the start of the current quota period across the whole account, excluding
  // those with ONLY failed captures (failed-only URLs do not consume a slot)
  const quotaWindowStart = getQuotaWindowStart(planProfile?.subscription_started_at)

  const { data: recentUrls } = await supabaseAdmin
    .from("urls")
    .select("id")
    .in("user_id", accountUserIds)
    .gte("created_at", quotaWindowStart.toISOString())

  const recentUrlIds = (recentUrls || []).map((u: any) => u.id)

  let currentCount = 0

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

    // Count URL if: has a successful capture OR is still pending (never attempted)
    // Do NOT count if it only has failed captures
    const countedIds = recentUrlIds.filter((id: string) => {
      const hasSuccess = successfulUrlIds.has(id)
      const hasFailed = failedUrlIds.has(id)
      const isPending = !hasSuccess && !hasFailed
      return hasSuccess || isPending
    })

    currentCount = countedIds.length
  }

  if (limit !== Infinity && currentCount >= limit) {
    const planLabel = plan === "pro" ? "Pro" : "Basic"
    return NextResponse.json(
      {
        error: `You've reached the ${planLabel} plan limit of ${limit} URLs per billing period. ${
          plan !== "pro"
            ? "Upgrade to Pro for up to 40 URLs per billing period."
            : ""
        }`,
        limitReached: true,
        plan,
        limit,
        current: currentCount,
      },
      { status: 403 }
    )
  }

  // Insert URL
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("urls")
    .insert([
      {
        url: url.trim(),
        user_id: userId,
        next_capture_at,
        last_captured_at: null,
        schedule_type,
        schedule_value: schedule_value || null,
        status: "active",
        label: sanitizeLabel(label),
      },
    ])
    .select()
    .single()

  if (insertError) {
    console.error("❌ Insert error:", insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ url: inserted })
}
