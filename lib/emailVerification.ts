type EmailVerificationUser = {
  email?: string | null
  email_confirmed_at?: string | null
  confirmed_at?: string | null
}

export function isEmailVerificationRequired(user: EmailVerificationUser | null | undefined): boolean {
  return !!user?.email
}

export function isEmailVerified(user: EmailVerificationUser | null | undefined): boolean {
  if (!user) return false
  if (!isEmailVerificationRequired(user)) return true
  return Boolean(user.email_confirmed_at || user.confirmed_at)
}
