export const SIGNUP_PLAN_STORAGE_KEY = "timedshot-signup-plan"

export type SignupPlan = "trial" | "basic" | "pro"

export function parseSignupPlan(value: string | null | undefined): SignupPlan | null {
  if (value === "basic" || value === "pro" || value === "trial") return value
  return null
}

export function normalizeSignupPlan(value: string | null | undefined): SignupPlan {
  return parseSignupPlan(value) ?? "trial"
}
