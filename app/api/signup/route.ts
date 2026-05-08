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

function buildWelcomeEmailHtml(confirmationUrl: string) {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#6A11CB,#FF7A00);display:inline-block;padding:12px 28px;border-radius:12px;">
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Timedshot</span>
    </div>
  </div>
  <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111;">Welcome to Timedshot! 🎉</h2>
  <p style="font-size:15px;color:#555;margin-bottom:28px;">
    Your account is ready. Click the button below to sign in and get started.
  </p>
  <div style="text-align:center;margin-bottom:32px;">
    <a href="${confirmationUrl}"
       style="background:linear-gradient(135deg,#6A11CB,#FF7A00);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;display:inline-block;">
      Access my account →
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
    You can also sign in anytime at ${process.env.NEXT_PUBLIC_SITE_URL}/login with your email and password.
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

    // ── Step 1: Create user as already confirmed ──────────────────────────────
    // Using email_confirm: true decouples account creation from email delivery.
    // Users can always sign in with their password even if the welcome email fails.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      if (isAlreadyRegisteredError(createError.message)) {
        // User already exists — resend a magic link so they can sign in
        const { error: resendError, confirmationUrl: resendUrl } = await resendSignupConfirmationEmail(email, emailRedirectTo)
        if (!resendError) return NextResponse.json({ ok: true, ...(resendUrl ? { confirmationUrl: resendUrl } : {}) })
        return NextResponse.json(
          { error: errorMessage(resendError, "Failed to resend confirmation email") },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // ── Step 2: Generate a one-time magic link for the post-signup redirect ───
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: emailRedirectTo },
    })

    if (linkError) {
      // Magic link generation failed, but user is confirmed and can log in with password
      console.warn("generateLink failed after createUser:", linkError.message)
      return NextResponse.json({ ok: true })
    }

    const confirmationUrl = linkData?.properties?.action_link

    // ── Step 3: Send welcome email via Resend (non-blocking) ─────────────────
    // If Resend is not configured or email delivery fails, auth still works —
    // the user can sign in at /login with their password.
    if (process.env.RESEND_API_KEY && confirmationUrl) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: emailError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Welcome to Timedshot — access your account",
        html: buildWelcomeEmailHtml(confirmationUrl),
      })

      if (emailError) {
        console.error("Welcome email send failed:", JSON.stringify(emailError))
        return NextResponse.json({ ok: true, confirmationUrl, emailDeliveryFailed: true })
      }
    }

    return NextResponse.json({ ok: true, ...(confirmationUrl ? { confirmationUrl } : {}) })
  } catch (err: any) {
    console.error("Signup API error:", err)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
