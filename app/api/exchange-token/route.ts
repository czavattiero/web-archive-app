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
      .select('id, otp_url')
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

    // Check if token is too old (older than 24 hours)
    // Note: We do this after the update to ensure atomic consumption
    // but could also add a check before the update to fail faster
    const { data: tokenAge, error: ageError } = await supabaseAdmin
      .from('verification_tokens')
      .select('created_at')
      .eq('id', updatedToken.id)
      .single()

    if (!ageError && tokenAge) {
      const ageInHours = (Date.now() - new Date(tokenAge.created_at).getTime()) / (1000 * 60 * 60)
      if (ageInHours > 24) {
        console.warn('Token is older than 24 hours:', token)
        return NextResponse.json(
          { error: 'This verification link has expired' },
          { status: 410 }
        )
      }
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
