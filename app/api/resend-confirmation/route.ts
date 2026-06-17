import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"

const VALID_PLANS = new Set(["trial", "basic", "pro"])

function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function buildVerifyUrl(otpUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  return `${siteUrl}/verify#${encodeURIComponent(otpUrl)}`
}

function buildEmailHtml(confirmationUrl: string) {
  const verifyUrl = buildVerifyUrl(confirmationUrl)
  return `
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
    <a href="${verifyUrl}"
       style="background:linear-gradient(135deg,#6A11CB,#FF7A00);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;display:inline-block;">
      Confirm my email
    </a>
  </div>
  <p style="font-size:13px;color:#888;margin-bottom:8px;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="font-size:12px;word-break:break-all;color:#6A11CB;">
    <a href="${verifyUrl}" style="color:#6A11CB;">${verifyUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <p style="font-size:12px;color:#aaa;text-align:center;">
    If you didn't create a Timedshot account, you can safely ignore this email.
  </p>
</div>`
}

export async function POST(req: Request) {
  try {
    const { email, plan } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const safePlan = VALID_PLANS.has(plan) ? plan : "trial"
    const emailRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?plan=${safePlan}`

    // ── Resend path ───────────────────────────────────────────────────────────
    if (process.env.RESEND_API_KEY) {
      console.log("ResendConfirmation: RESEND_API_KEY is set — using Resend path")
      const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup" as "magiclink",
        email,
        options: { redirectTo: emailRedirectTo },
      })

      if (linkError) {
        console.error("ResendConfirmation: generateLink failed:", linkError.message)
        return NextResponse.json({ error: linkError.message }, { status: 400 })
      }

      console.log("ResendConfirmation: generateLink succeeded")
      const confirmationUrl = data?.properties?.action_link
      if (!confirmationUrl) {
        // generateLink returned no URL — fall back to Supabase SMTP resend
        console.warn("ResendConfirmation: generateLink returned empty action_link, falling back to Supabase SMTP")
        const supabasePublic = createSupabasePublicClient()
        const { error: fallbackError } = await supabasePublic.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo },
        })
        if (fallbackError) {
          console.error("ResendConfirmation: Supabase SMTP fallback failed:", fallbackError.message)
          return NextResponse.json(
            { error: `Email delivery failed. Please try again.` },
            { status: 500 }
          )
        }
        console.log("ResendConfirmation: confirmation email sent via Supabase SMTP fallback")
        return NextResponse.json({ ok: true })
      }

      // Attempt Resend delivery
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: emailError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Confirm your email – Timedshot",
        html: buildEmailHtml(confirmationUrl),
      })

      if (emailError) {
        // Resend failed — fall back to Supabase SMTP
        console.error("ResendConfirmation: Resend send failed, falling back to Supabase SMTP:", JSON.stringify(emailError))
        const supabasePublic = createSupabasePublicClient()
        const { error: fallbackError } = await supabasePublic.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo },
        })
        if (fallbackError) {
          const resendMsg = (emailError as any).message ?? "unknown"
          return NextResponse.json(
            { error: `Email delivery failed (Resend: ${resendMsg}; Supabase SMTP: ${fallbackError.message}). Please try again.` },
            { status: 500 }
          )
        }
        console.log("ResendConfirmation: confirmation email sent via Supabase SMTP fallback after Resend failure")
        return NextResponse.json({ ok: true })
      }

      console.log("ResendConfirmation: confirmation email sent successfully via Resend")
      return NextResponse.json({ ok: true })
    }

    // ── Fallback path – Supabase native SMTP ─────────────────────────────────
    console.log("ResendConfirmation: RESEND_API_KEY not set — using Supabase SMTP fallback")
    const supabasePublic = createSupabasePublicClient()
    const { error } = await supabasePublic.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Resend confirmation API error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
