import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

/**
 * Informational emails to the admin about account activity:
 * new sign-ups, email confirmations, team invites and new paid subscriptions.
 *
 * Every function here is fire-and-forget safe: it never throws, so a
 * notification problem can never break the request that triggered it.
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "czavattiero@gmail.com"
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"

function albertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
    dateStyle: "medium",
    timeStyle: "short",
  })
}

/**
 * Records a one-time marker in alert_throttle. Returns true the first time a
 * key is seen and false afterwards, so repeated events (a revisited
 * confirmation link, a Stripe webhook retry) send only one email.
 * If the marker can't be written, returns true: a rare duplicate email is
 * better than a missed notification.
 */
async function claimOnce(key: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from("alert_throttle")
      .upsert(
        { route_key: `notify-once:${key}`, last_sent_at: new Date().toISOString() },
        { onConflict: "route_key", ignoreDuplicates: true }
      )
      .select("route_key")

    if (error) {
      console.warn("adminNotifications: once-marker failed, sending anyway:", error.message)
      return true
    }
    return (data?.length ?? 0) > 0
  } catch (err: any) {
    console.warn("adminNotifications: once-marker threw, sending anyway:", err?.message || err)
    return true
  }
}

async function sendAdminNotice(subject: string, lines: string[], onceKey?: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn(`adminNotifications: RESEND_API_KEY not set — skipping "${subject}"`)
      return
    }
    if (onceKey && !(await claimOnce(onceKey))) {
      console.log(`adminNotifications: already sent for ${onceKey}, skipping`)
      return
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_ALERT_EMAIL,
      subject: `[Timedshot] ${subject}`,
      text: [...lines, `Time: ${albertaTime()} (Alberta)`].join("\n"),
    })

    if (error) {
      console.error(`adminNotifications: Resend error for "${subject}":`, JSON.stringify(error))
      return
    }
    console.log(`adminNotifications: sent "${subject}"`)
  } catch (err: any) {
    console.error(`adminNotifications: failed to send "${subject}":`, err?.message || err)
  }
}

/** A brand-new account was created (before email confirmation). */
export function notifyNewSignup(email: string, plan: string) {
  return sendAdminNotice(
    `New sign-up: ${email}`,
    [
      "A new Timedshot account was created.",
      "",
      `Email: ${email}`,
      `Plan selected: ${plan}`,
      "Status: waiting for the user to confirm their email",
    ]
  )
}

/** The user clicked their confirmation link and their account is now active. */
export function notifyEmailConfirmed(userId: string, email: string, plan: string) {
  const nextStep =
    plan === "basic" || plan === "pro"
      ? "Next step: they are being sent to Stripe checkout"
      : "Next step: free trial started"
  return sendAdminNotice(
    `Email confirmed: ${email}`,
    [
      "A new user confirmed their email address.",
      "",
      `Email: ${email}`,
      `Plan selected: ${plan}`,
      nextStep,
    ],
    `confirmed:${userId}`
  )
}

/** An account owner invited a team member. */
export function notifyTeamInvite(invitedEmail: string, ownerEmail: string | null | undefined) {
  return sendAdminNotice(`Team member invited: ${invitedEmail}`, [
    "A customer invited a team member to their account.",
    "",
    `Invited: ${invitedEmail}`,
    `Invited by: ${ownerEmail || "(unknown)"}`,
  ])
}

/** A Stripe checkout completed, so a paid subscription started. */
export function notifyNewPaidSubscription(opts: {
  dedupeKey: string
  email: string | null | undefined
  plan: string
  firstTime: boolean
}) {
  const who = opts.email || "(unknown email)"
  return sendAdminNotice(
    opts.firstTime ? `New paying customer: ${who}` : `Subscription started again: ${who}`,
    [
      opts.firstTime
        ? "A customer completed Stripe checkout for the first time."
        : "A returning customer completed Stripe checkout (resubscribe or plan change).",
      "",
      `Email: ${who}`,
      `Plan: ${opts.plan}`,
    ],
    `paid:${opts.dedupeKey}`
  )
}
