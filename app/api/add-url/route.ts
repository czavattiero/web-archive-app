import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_LIMITS: Record<string, number> = {
  pro: 40,
  basic: 15,
  trial: 15,
}

export async function POST(req: Request) {
  const body = await req.json()
  const { userId, url, schedule_type, schedule_value, next_capture_at } = body

  if (!userId || !url) {
    return NextResponse.json({ error: "userId and url are required" }, { status: 400 })
  }

  // Get user plan
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, subscribed, trial_ends_at")
    .eq("id", userId)
    .maybeSingle()

  const plan: string = profile?.plan || "basic"

  // Check trial expiry
  const isTrial = profile?.plan === "trial" && !profile?.subscribed
  const trialExpired = isTrial && profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date()

  if (trialExpired) {
    return NextResponse.json(
      { error: "Your free trial has expired. Please choose a plan to continue.", trialExpired: true },
      { status: 403 }
    )
  }

  const limit = PLAN_LIMITS[plan] ?? 15

  // Count URLs added in the last 30 days, excluding those with ONLY failed captures
  // (failed-only URLs do not consume a slot — only successful or pending URLs count)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentUrls } = await supabaseAdmin
    .from("urls")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString())

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

  if (currentCount >= limit) {
    const planLabel = plan === "pro" ? "Pro" : "Basic"
    return NextResponse.json(
      {
        error: `You've reached the ${planLabel} plan limit of ${limit} URLs per 30 days. ${
          plan !== "pro"
            ? "Upgrade to Pro for up to 40 URLs per 30 days."
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