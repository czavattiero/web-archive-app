import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "czavattiero@gmail.com"
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"

// Minimum time between two alert emails for the same user+route combo.
// Prevents one user retrying the same broken action from sending dozens of
// emails, while still emailing separately for each distinct affected user.
const THROTTLE_WINDOW_MS = 10 * 60 * 1000

/**
 * Fire-and-forget admin alert email for a critical server-side error.
 * Never throws — a failure here should never break the request that
 * triggered it. Call from a catch block:
 *
 *   alertAdmin("capture", "Capture workflow dispatch failed", err.message, authUser)
 */
export async function alertAdmin(
  routeKey: string,
  subject: string,
  details: string,
  userContext?: { id?: string | null; email?: string | null }
): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(`alertAdmin: RESEND_API_KEY not set — skipping alert for ${routeKey}`)
      return
    }

    // Identify the user for throttling purposes: prefer id, fall back to
    // email (e.g. signup failures before an account exists), fall back to
    // "anonymous" for routes with no user context at all (e.g. a Stripe
    // webhook signature failure with no request body parsed yet).
    const userIdentifier = userContext?.id || userContext?.email || "anonymous"
    const throttleKey = `${routeKey}:${userIdentifier}`

    const { data: throttleRow } = await supabaseAdmin
      .from("alert_throttle")
      .select("last_sent_at")
      .eq("route_key", throttleKey)
      .maybeSingle()

    if (throttleRow?.last_sent_at) {
      const elapsed = Date.now() - new Date(throttleRow.last_sent_at).getTime()
      if (elapsed < THROTTLE_WINDOW_MS) {
        console.log(`alertAdmin: throttled for ${throttleKey} (${Math.round(elapsed / 1000)}s since last alert)`)
        return
      }
    }

    // Upsert the throttle timestamp before sending so two near-simultaneous
    // failures don't both slip through the throttle check.
    await supabaseAdmin
      .from("alert_throttle")
      .upsert({ route_key: throttleKey, last_sent_at: new Date().toISOString() }, { onConflict: "route_key" })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const userLine = userContext?.email || userContext?.id
      ? `\nUser: ${userContext?.email ?? "(no email)"}${userContext?.id ? ` (${userContext.id})` : ""}\n`
      : ""
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_ALERT_EMAIL,
      subject: `[Timedshot alert] ${subject}`,
      text: `${subject}\n\nRoute: ${routeKey}\nTime: ${new Date().toISOString()}${userLine}\nDetails:\n${details}\n\n(Further alerts for this user on this route are throttled to at most one every ${THROTTLE_WINDOW_MS / 60000} minutes.)`,
    })

    console.log(`alertAdmin: sent alert for ${throttleKey}`)
  } catch (alertErr: any) {
    // Never let an alert failure surface to the caller.
    console.error("alertAdmin: failed to send alert:", alertErr?.message || alertErr)
  }
}
