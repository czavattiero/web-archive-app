/**
 * Wraps a Supabase OTP URL in the scanner-safe /verify redirect.
 *
 * Email security scanners (Gmail, Microsoft SafeLinks, Barracuda, …) pre-fetch
 * every <a href> in an email via plain GET requests.  Because the URL fragment
 * (hash) is never sent to the server and scanners don't execute JavaScript, the
 * one-time token is preserved for the real user's click.
 */
export function buildVerifyUrl(otpUrl: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  return `${siteUrl}/verify#${encodeURIComponent(otpUrl)}`
}
