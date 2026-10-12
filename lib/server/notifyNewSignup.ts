import { Resend } from "resend"

const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "czavattiero@gmail.com"
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"

/**
 * Email the admin when a brand-new account is created.
 * Never throws — a failure here must never break signup.
 */
export async function notifyNewSignup(email: string, plan: string): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("notifyNewSignup: RESEND_API_KEY not set — skipping new-signup email")
      return
    }

    const time = new Date().toLocaleString("en-CA", {
      timeZone: "America/Edmonton",
      dateStyle: "medium",
      timeStyle: "short",
    })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_ALERT_EMAIL,
      subject: `[Timedshot] New sign-up: ${email}`,
      text:
        `A new Timedshot account was created.\n\n` +
        `Email: ${email}\n` +
        `Plan selected: ${plan}\n` +
        `Time: ${time} (Alberta)\n\n` +
        `The user still needs to confirm their email before they can log in.`,
    })

    if (error) {
      console.error("notifyNewSignup: Resend returned an error:", JSON.stringify(error))
      return
    }
    console.log(`notifyNewSignup: sent for ${email}`)
  } catch (err: any) {
    console.error("notifyNewSignup: failed to send:", err?.message || err)
  }
}
