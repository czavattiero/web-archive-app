import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import dns from "dns/promises"
import net from "net"
import { getQuotaWindowStart } from "../../../lib/quotaWindow"
import { getAccountUserIds, getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TITLE_FETCH_TIMEOUT_MS = 5000
const TITLE_HTML_READ_LIMIT = 50_000 // bytes — enough to find <title> without buffering large pages

function isPrivateIp(ip: string): boolean {
  if (ip === "::1") return true
  const lower = ip.toLowerCase()
  // IPv6 unique local (fc00::/7), link-local (fe80::/10), deprecated site-local (fec0::/10)
  if (lower.startsWith("fc") || lower.startsWith("fd") || /^fe[89a-f]/i.test(lower)) return true
  if (!net.isIPv4(ip)) return false
  const parts = ip.split(".").map(Number)
  return (
    parts[0] === 0 ||                                                       // 0.0.0.0/8
    parts[0] === 10 ||                                                      // 10.0.0.0/8
    parts[0] === 127 ||                                                     // 127.0.0.0/8 loopback
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||             // 100.64.0.0/10 CGNAT
    (parts[0] === 169 && parts[1] === 254) ||                               // 169.254.0.0/16 link-local
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||              // 172.16.0.0/12
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) ||              // 192.0.0.0/24 IETF
    (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) ||              // 192.0.2.0/24 TEST-NET-1
    (parts[0] === 192 && parts[1] === 168) ||                               // 192.168.0.0/16
    (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) ||              // 198.18.0.0/15 benchmarking
    (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) ||           // 198.51.100.0/24 TEST-NET-2
    (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) ||            // 203.0.113.0/24 TEST-NET-3
    parts[0] >= 224                                                         // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  )
}

async function isSafeUrl(urlString: string): Promise<boolean> {
  try {
    const parsed = new URL(urlString)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    const hostname = parsed.hostname
    // Direct IP supplied — validate immediately without DNS
    if (net.isIP(hostname)) return !isPrivateIp(hostname)
    // DNS-based check — note: pre-fetch DNS validation cannot fully prevent DNS rebinding,
    // but redirect:"manual" on the fetch prevents the most common exploit vector.
    const addresses = await dns.lookup(hostname, { all: true })
    return addresses.every(({ address }) => !isPrivateIp(address))
  } catch {
    return false
  }
}

function decodeHtmlEntities(text: string): string {
  // Decode numeric and named entities first, then &amp; last to avoid double-decoding.
  // Numeric codes are clamped to valid Unicode; control chars (except tab/newline) are stripped.
  return text
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      if (code > 0x10ffff || (code < 0x20 && code !== 0x09 && code !== 0x0a)) return ""
      return String.fromCodePoint(code)
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16)
      if (code > 0x10ffff || (code < 0x20 && code !== 0x09 && code !== 0x0a)) return ""
      return String.fromCodePoint(code)
    })
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
}

async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    if (!(await isSafeUrl(url))) return null
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TITLE_FETCH_TIMEOUT_MS)
    // redirect:"manual" prevents redirect-based SSRF bypass
    // eslint-disable-next-line no-restricted-globals -- URL is validated by isSafeUrl above
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TimedShot/1.0)" },
    })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    // Read only the first TITLE_HTML_READ_LIMIT bytes to avoid buffering large pages
    const reader = response.body?.getReader()
    if (!reader) return null
    let html = ""
    const decoder = new TextDecoder()
    while (html.length < TITLE_HTML_READ_LIMIT) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
    }
    reader.cancel()
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    if (!match) return null
    const raw = decodeHtmlEntities(match[1]).trim()
    return raw || null
  } catch {
    return null
  }
}

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
  const { userId, url, schedule_type, schedule_value, next_capture_at } = body

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

  // Best-effort: fetch the page title to use as position_title
  const positionTitle = await fetchPageTitle(url.trim())

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
        position_title: positionTitle || null,
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
