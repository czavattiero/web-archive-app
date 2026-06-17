import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

    const clientIp = getClientIp(req)

    // Look up the token
    const { data: tokenData, error: lookupError } = await supabaseAdmin
      .from('verification_tokens')
      .select('id, otp_url, consumed_at')
      .eq('token', token)
      .single()

    if (lookupError || !tokenData) {
      console.error('Token lookup failed:', lookupError?.message)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    // Check if token has already been consumed
    if (tokenData.consumed_at) {
      console.warn('Token already consumed:', token)
      return NextResponse.json(
        { error: 'This verification link has already been used' },
        { status: 410 }
      )
    }

    // Mark token as consumed
    const { error: updateError } = await supabaseAdmin
      .from('verification_tokens')
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_ip: clientIp,
      })
      .eq('id', tokenData.id)

    if (updateError) {
      console.error('Failed to mark token as consumed:', updateError.message)
      // Continue anyway - better to let the user through than fail
    }

    // Return the OTP URL
    return NextResponse.json({ otpUrl: tokenData.otp_url })
  } catch (err: any) {
    console.error('Exchange token API error:', err)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
