import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.com>"

const VALID_PLANS = new Set(["trial", "basic", "pro"])

export async function POST(req: Request) {
  try {
    const { email, password, plan } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const safePlan = VALID_PLANS.has(plan) ? plan : "trial"

    const emailRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/signup?confirmed=true&plan=${safePlan}`

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: { redirectTo: emailRedirectTo },
    })

    if (linkError) {
      // Pass through "already registered" so the client can handle it
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    const confirmationUrl = data?.properties?.action_link
    if (!confirmationUrl) {
      return NextResponse.json({ error: "Failed to generate confirmation link" }, { status: 500 })
    }

    // When ALLOW_DISPOSABLE_EMAILS is set, skip Resend and return the
    // confirmation URL directly so testers can complete the flow without a
    // real inbox (useful for disposable / temporary email addresses).
    if (process.env.ALLOW_DISPOSABLE_EMAILS === "true") {
      return NextResponse.json({ ok: true, confirmationUrl })
    }

    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#6A11CB,#FF7A00);display:inline-block;padding:12px 28px;border-radius:12px;">
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Timedshot</span>
    </div>
  </div>
  <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111;">Confirm your email</h2>
  <p style="font-size:15px;color:#555;margin-bottom:28px;">
    Thanks for signing up! Click the button below to verify your email address and activate your account.
  </p>
  <div style="text-align:center;margin-bottom:32px;">
    <a href="${confirmationUrl}"
       style="background:linear-gradient(135deg,#6A11CB,#FF7A00);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;display:inline-block;">
      Confirm my email
    </a>
  </div>
  <p style="font-size:13px;color:#888;margin-bottom:8px;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="font-size:12px;word-break:break-all;color:#6A11CB;">
    <a href="${confirmationUrl}" style="color:#6A11CB;">${confirmationUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <p style="font-size:12px;color:#aaa;text-align:center;">
    If you didn't create a Timedshot account, you can safely ignore this email.
  </p>
</div>`

    const { error: emailError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Confirm your email – Timedshot",
      html,
    })

    if (emailError) {
      console.error("Failed to send confirmation email via Resend:", emailError)
      return NextResponse.json({ error: "We couldn't send a confirmation email. Please try again or contact support." }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Signup API error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
