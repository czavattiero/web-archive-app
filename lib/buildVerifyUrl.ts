import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Wraps a Supabase OTP URL in the scanner-safe /verify redirect with token exchange.
 *
 * Email security scanners (Gmail, Microsoft SafeLinks, Barracuda, …) pre-fetch
 * every <a href> in an email and can even extract embedded URLs from the href
 * attribute. To prevent scanners from consuming the one-time Supabase token, we:
 * 1. Generate a random token and store it in the database with the OTP URL
 * 2. Put only the random token in the URL hash (not the OTP URL)
 * 3. When the user clicks the button, exchange the token for the OTP URL via API
 * 
 * This ensures scanners cannot access the actual Supabase OTP URL.
 */
export async function buildVerifyUrl(otpUrl: string): Promise<string> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  
  // Generate a cryptographically secure random token
  const token = crypto.randomBytes(32).toString('base64url')
  
  try {
    // Store the token and OTP URL mapping in the database
    const { error } = await supabaseAdmin
      .from('verification_tokens')
      .insert({
        token,
        otp_url: otpUrl,
      })
    
    if (error) {
      console.error('Failed to store verification token:', error.message)
      // Fallback to old behavior if database insert fails
      return `${siteUrl}/verify#${encodeURIComponent(otpUrl)}`
    }
    
    // Return URL with just the random token (not the OTP URL)
    return `${siteUrl}/verify#${token}`
  } catch (err) {
    console.error('Error in buildVerifyUrl:', err)
    // Fallback to old behavior on error
    return `${siteUrl}/verify#${encodeURIComponent(otpUrl)}`
  }
}
