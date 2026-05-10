/**
 * Clamps the given day to the last valid day of the specified month,
 * handling months shorter than the anniversary day (e.g. Feb 28/29).
 */
function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

/**
 * Returns the start of the current quota period for a subscribed user.
 *
 * For subscribed users: finds the most recent monthly anniversary of
 * `subscription_started_at` that is <= now, and returns that date.
 *
 * For trial/unsubscribed users: falls back to `now - 30 days`.
 */
export function getQuotaWindowStart(subscriptionStartedAt: string | null | undefined): Date {
  if (!subscriptionStartedAt) {
    // Trial or no subscription: rolling 30-day window
    const fallback = new Date()
    fallback.setDate(fallback.getDate() - 30)
    return fallback
  }

  const startDate = new Date(subscriptionStartedAt)
  const now = new Date()

  // Find the most recent anniversary day-of-month <= today
  const anniversaryDay = startDate.getDate() // e.g. 10 for the 10th

  // Try this month's anniversary
  const thisMonthAnniversary = clampToMonth(now.getFullYear(), now.getMonth(), anniversaryDay)

  if (thisMonthAnniversary <= now) {
    return thisMonthAnniversary
  } else {
    // Use last month's anniversary
    return clampToMonth(now.getFullYear(), now.getMonth() - 1, anniversaryDay)
  }
}
