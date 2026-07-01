import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * TEMPORARY DIAGNOSTIC ENDPOINT
 * GET /api/debug-email
 *
 * Shows the current email configuration so you can confirm env vars
 * are set correctly in production without exposing secret values.
 *
 * ⚠️  Remove this file once the email verification issue is confirmed resolved.
 */
export async function GET() {
  const resendKey = process.env.RESEND_API_KEY
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const fromEmail = process.env.FROM_EMAIL

  // Test Supabase admin connectivity
  let supabaseAdminOk = false
  let supabaseAdminError: string | null = null
  try {
    const admin = createClient(supabaseUrl!, serviceKey!)
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    supabaseAdminOk = !error
    supabaseAdminError = error?.message ?? null
  } catch (e: any) {
    supabaseAdminError = e.message
  }

  const diagnosis: string[] = []

  if (!resendKey) {
    diagnosis.push("RESEND_API_KEY is NOT set — will use Supabase SMTP only")
  } else if (!resendKey.startsWith("re_")) {
    diagnosis.push("RESEND_API_KEY is set but does NOT start with 're_' — likely invalid")
  } else {
    diagnosis.push("RESEND_API_KEY looks valid (starts with 're_')")
  }

  if (!siteUrl) {
    diagnosis.push("NEXT_PUBLIC_SITE_URL is NOT set — email redirect URLs will be broken!")
  } else {
    diagnosis.push(`NEXT_PUBLIC_SITE_URL = ${siteUrl}`)
  }

  if (!supabaseAdminOk) {
    diagnosis.push(`Supabase admin connection FAILED: ${supabaseAdminError}`)
  } else {
    diagnosis.push("Supabase admin connection OK")
  }

  return NextResponse.json({
    diagnosis,
    config: {
      RESEND_API_KEY: resendKey ? `set (${resendKey.slice(0, 6)}...)` : "NOT SET",
      NEXT_PUBLIC_SITE_URL: siteUrl || "NOT SET",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? "set" : "NOT SET",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? "set" : "NOT SET",
      SUPABASE_SERVICE_ROLE_KEY: serviceKey ? "set" : "NOT SET",
      FROM_EMAIL: fromEmail || "not set (using default: Timedshot <noreply@timedshot.ca>)",
    },
    supabaseAdmin: {
      ok: supabaseAdminOk,
      error: supabaseAdminError,
    },
    note: "Remove app/api/debug-email/route.ts once the email issue is confirmed resolved.",
  })
}
