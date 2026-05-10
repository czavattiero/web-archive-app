import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getQuotaWindowStart } from "../../../lib/quotaWindow"

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
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  // Look up the user's profile to determine if they are a sub-user
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, parent_user_id, subscription_started_at")
    .eq("id", userId)
    .maybeSingle()

  // Resolve the owner (parent) ID
  const ownerId: string = profile?.parent_user_id || userId

  // Get the owner's plan if this is a sub-user
  let plan: string = profile?.plan || "basic"
  let ownerSubscriptionStartedAt: string | null | undefined = profile?.subscription_started_at
  if (profile?.parent_user_id) {
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("plan, subscription_started_at")
      .eq("id", ownerId)
      .maybeSingle()
    plan = ownerProfile?.plan || "basic"
    ownerSubscriptionStartedAt = ownerProfile?.subscription_started_at
  }

  const limit = PLAN_LIMITS[plan] ?? 15

  // Collect all user IDs in this account (owner + sub-users)
  const { data: subUsers } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("parent_user_id", ownerId)

  const accountUserIds: string[] = [ownerId, ...(subUsers || []).map((u: any) => u.id)]

  // Count URLs added since the start of the current quota period across the whole account,
  // excluding those with ONLY failed captures (same logic as add-url/route.ts)
  const quotaWindowStart = getQuotaWindowStart(ownerSubscriptionStartedAt)

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

  return NextResponse.json({ urlCount, plan, limit })
}
