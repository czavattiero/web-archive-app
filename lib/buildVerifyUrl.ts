import crypto from "crypto"
import { type SignupPlan } from "./signupPlan"

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const STATELESS_TOKEN_PREFIX = "st1"

function buildStatelessVerificationToken(otpUrl: string): string {
  const signingKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!signingKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for verification token signing")
  }
  const payload = {
    otpUrl,
    exp: Date.now() + VERIFICATION_TOKEN_TTL_MS,
  }
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(payloadBase64)
    .digest("base64url")
  return `${STATELESS_TOKEN_PREFIX}.${payloadBase64}.${signature}`
}

/**
 * Wraps a Supabase OTP URL in a scanner-safe /verify redirect with token exchange.
 *
 * Email security scanners (Gmail, Microsoft SafeLinks, Barracuda, …) pre-fetch
 * email links. To avoid exposing Supabase OTP URLs directly, we sign a short-lived
 * payload and place it in the URL hash. The browser exchanges this token for the
 * real OTP URL only after explicit user interaction on /verify.
 */
export async function buildVerifyUrl(otpUrl: string, plan: SignupPlan): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  const verifyUrl = new URL("/verify", siteUrl)
  verifyUrl.searchParams.set("plan", plan)

  // Use a signed, stateless token for new links so scanner prefetches cannot
  // invalidate the link by consuming server-side one-time state.
  const statelessToken = buildStatelessVerificationToken(otpUrl)
  return `${verifyUrl.toString()}#${statelessToken}`
}
