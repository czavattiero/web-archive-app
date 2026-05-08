import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.com>"

const VALID_PLANS = new Set(["trial", "basic", "pro"])
const ALREADY_REGISTERED_ERROR = "already registered"

function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function buildEmailHtml(confirmationUrl: string) {
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
}

/**
 * Send a Resend email then fall back to supabasePublic.auth.resend() if Resend
 * fails.  Returns { error: null } on success or { error: { message } } if both
 * paths fail.
 */
async function sendViaResendWithFallback(
  email: string,
  confirmationUrl: string,
  emailRedirectTo: string
) {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const { error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Confirm your email – Timedshot",
    html: buildEmailHtml(confirmationUrl),
  })

  if (!emailError) return { error: null }

  // Resend failed — fall back to Supabase SMTP
  console.error("Resend send failed, falling back to Supabase SMTP:", JSON.stringify(emailError))
  const supabasePublic = createSupabasePublicClient()
  const { error: fallbackError } = await supabasePublic.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  })

  if (fallbackError) {
    const resendMsg = (emailError as any).message ?? "unknown"
    return {
      error: {
        message: `Email delivery failed (Resend: ${resendMsg}; Supabase SMTP: ${fallbackError.message}). Please try again.`,
      },
    }
  }

  return { error: null }
}

async function resendSignupConfirmationEmail(email: string, emailRedirectTo: string): Promise<{ error: { message?: string } | null; confirmationUrl?: string }> {
  if (process.env.RESEND_API_KEY) {
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: emailRedirectTo },
    })

    if (linkError) return { error: linkError }

    const confirmationUrl = data?.properties?.action_link
    if (!confirmationUrl) {
      // generateLink returned no URL — fall through to Supabase SMTP resend
      console.warn("generateLink returned empty action_link for resend, falling back to Supabase SMTP")
      const supabasePublic = createSupabasePublicClient()
      const { error } = await supabasePublic.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo },
      })
      return { error: error ?? null }
    }

    const { error: sendError } = await sendViaResendWithFallback(email, confirmationUrl, emailRedirectTo)
    return { error: sendError, confirmationUrl: sendError ? undefined : confirmationUrl }
  }

  // No RESEND_API_KEY — use supabase auth.resend() for SMTP email
  const supabasePublic = createSupabasePublicClient()
  const { error } = await supabasePublic.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
  })
  if (error) return { error }

  return { error: null }
}

function isAlreadyRegisteredError(message?: string) {
  return message?.toLowerCase().includes(ALREADY_REGISTERED_ERROR)
}

function errorMessage(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback
}

export async function POST(req: Request) {
  try {
    const { email, password, plan } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const safePlan = VALID_PLANS.has(plan) ? plan : "trial"
    const emailRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/signup?confirmed=true&plan=${safePlan}`

    // ── Production mode – Resend ──────────────────────────────────────────────
    if (process.env.RESEND_API_KEY) {
      const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: { redirectTo: emailRedirectTo },
      })

      if (linkError) {
        if (isAlreadyRegisteredError(linkError.message)) {
          const { error: resendError, confirmationUrl: resendUrl } = await resendSignupConfirmationEmail(email, emailRedirectTo)
          if (!resendError) return NextResponse.json({ ok: true, ...(resendUrl ? { confirmationUrl: resendUrl } : {}) })
          return NextResponse.json(
            { error: errorMessage(resendError, "Failed to resend confirmation email") },
            { status: 400 }
          )
        }
        return NextResponse.json({ error: linkError.message }, { status: 400 })
      }

      const confirmationUrl = data?.properties?.action_link
      if (!confirmationUrl) {
        // generateLink succeeded but returned no URL — fall back to Supabase signUp
        console.warn("generateLink returned empty action_link, falling back to Supabase SMTP signUp")
        const supabasePublic = createSupabasePublicClient()
        const { error: fallbackError } = await supabasePublic.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        })
        if (fallbackError && !isAlreadyRegisteredError(fallbackError.message)) {
          return NextResponse.json(
            { error: `Email delivery failed (no confirmation link; SMTP: ${fallbackError.message}). Please try again.` },
            { status: 500 }
          )
        }
        return NextResponse.json({ ok: true })
      }

      const { error: sendError } = await sendViaResendWithFallback(email, confirmationUrl, emailRedirectTo)
      if (sendError) {
        // Email delivery failed completely, but we still have a valid confirmation URL — return it
        // so the user can verify directly via the fallback button rather than seeing a hard error.
        console.error("All email delivery failed:", sendError.message)
        return NextResponse.json({ ok: true, confirmationUrl, emailDeliveryFailed: true })
      }

      return NextResponse.json({ ok: true, confirmationUrl })
    }

    // ── Fallback mode – Supabase native SMTP ─────────────────────────────────
    const supabasePublic = createSupabasePublicClient()
    const { error: signUpError } = await supabasePublic.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    })

    if (signUpError) {
      if (isAlreadyRegisteredError(signUpError.message)) {
        const { error: resendError, confirmationUrl: resendUrl } = await resendSignupConfirmationEmail(email, emailRedirectTo)
        if (!resendError) return NextResponse.json({ ok: true, ...(resendUrl ? { confirmationUrl: resendUrl } : {}) })
        return NextResponse.json(
          { error: errorMessage(resendError, "Failed to resend confirmation email") },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Signup API error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
