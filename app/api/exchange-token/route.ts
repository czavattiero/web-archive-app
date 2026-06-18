import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Common scanner user-agents to reject
const SCANNER_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /scraper/i,
  /scanner/i,
  /preview/i,
  /link.?validator/i,
  /security.?scanner/i,
  /safelink/i,
  /barracuda/i,
  /mimecast/i,
  /proofpoint/i,
]
const STATELESS_TOKEN_PREFIX = "st1"
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

function isLikelyScanner(userAgent: string): boolean {
  return SCANNER_PATTERNS.some(pattern => pattern.test(userAgent))
}

function getClientIp(req: Request): string {
  // Try various headers that might contain the real client IP
  const headers = {
    'x-forwarded-for': req.headers.get('x-forwarded-for'),
    'x-real-ip': req.headers.get('x-real-ip'),
    'cf-connecting-ip': req.headers.get('cf-connecting-ip'),
  }
  
  return headers['x-forwarded-for']?.split(',')[0]?.trim() 
    || headers['x-real-ip'] 
    || headers['cf-connecting-ip']
    || 'unknown'
}

function decodeStatelessToken(token: string): { otpUrl: string; exp: number } | null {
  const [prefix, payloadBase64, signature] = token.split(".")
  if (!prefix || !payloadBase64 || !signature || prefix !== STATELESS_TOKEN_PREFIX) {
    return null
  }

  const signingKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!signingKey) return null

  const expectedSignature = crypto
    .createHmac("sha256", signingKey)
    .update(payloadBase64)
    .digest("base64url")

  const actualSig = Buffer.from(signature, "base64url")
  const expectedSig = Buffer.from(expectedSignature, "base64url")
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"))
    if (!parsed || typeof parsed.otpUrl !== "string" || typeof parsed.exp !== "number") {
      return null
    }
    return { otpUrl: parsed.otpUrl, exp: parsed.exp }
  } catch {
    return null
  }
}

function isValidSupabaseOtpUrl(otpUrl: string): boolean {
  try {
    const parsed = new URL(otpUrl)
    const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin
    return Boolean(supabaseOrigin) && parsed.origin === supabaseOrigin
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent') || ''
    
    // Basic scanner detection - log but don't block yet to avoid false positives
    if (isLikelyScanner(userAgent)) {
      console.warn('Possible scanner detected:', userAgent)
    }

    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    // New stateless format used by recently-sent emails.
    const statelessPayload = decodeStatelessToken(token)
    if (statelessPayload) {
      if (Date.now() > statelessPayload.exp) {
        return NextResponse.json(
          { error: 'This verification link has expired' },
          { status: 410 }
        )
      }
      if (statelessPayload.exp - Date.now() > VERIFICATION_TOKEN_TTL_MS) {
        return NextResponse.json(
          { error: 'Invalid verification link' },
          { status: 400 }
        )
      }
      if (!isValidSupabaseOtpUrl(statelessPayload.otpUrl)) {
        return NextResponse.json(
          { error: 'Invalid verification link' },
          { status: 400 }
        )
      }
      return NextResponse.json({ otpUrl: statelessPayload.otpUrl })
    }

    const clientIp = getClientIp(req)
    const minCreatedAt = new Date(Date.now() - VERIFICATION_TOKEN_TTL_MS).toISOString()

    // Use atomic update with WHERE clause to ensure token can only be consumed once
    // This prevents race conditions where multiple requests could exchange the same token
    const { data: updatedToken, error: updateError } = await supabaseAdmin
      .from('verification_tokens')
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_ip: clientIp,
      })
      .eq('token', token)
      .is('consumed_at', null) // Only update if not already consumed
      .gt('created_at', minCreatedAt) // Expire old links atomically
      .select('otp_url')
      .single()

    if (updateError || !updatedToken) {
      // Token doesn't exist, already consumed, or database error
      if (updateError?.code === 'PGRST116') {
        // No rows matched = token already consumed or doesn't exist
        console.warn('Token not found or already consumed:', token)
        return NextResponse.json(
          { error: 'This verification link has expired or already been used' },
          { status: 410 }
        )
      }
      
      console.error('Token update failed:', updateError?.message)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    if (!isValidSupabaseOtpUrl(updatedToken.otp_url)) {
      return NextResponse.json(
        { error: 'Invalid verification link' },
        { status: 400 }
      )
    }

    // Return the OTP URL
    console.log('Token successfully exchanged:', { token: token.substring(0, 8) + '...', ip: clientIp })
    return NextResponse.json({ otpUrl: updatedToken.otp_url })
  } catch (err: any) {
    console.error('Exchange token API error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
