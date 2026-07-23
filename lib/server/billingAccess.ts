import { createClient } from "@supabase/supabase-js"
import { isEmailVerified } from "../emailVerification"

type ProfileRow = {
  id: string
  plan: string | null
  subscribed: boolean | null
  trial_ends_at: string | null
  subscription_started_at?: string | null
  parent_user_id?: string | null
}

type SubscriptionStartedAtRow = {
  subscription_started_at?: string | null
}

export type BillingAccessDecision = {
  allowed: boolean
  reason: "ok" | "profile_not_found" | "trial_expired" | "payment_required"
  ownerId: string | null
  userProfile: ProfileRow | null
  billingProfile: ProfileRow | null
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const PROFILE_AUTO_REPAIR_TRIAL_DAYS = 15
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>()
  if (!cookieHeader) return cookies
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim()
    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) continue
    const name = trimmed.slice(0, separatorIndex)
    const value = trimmed.slice(separatorIndex + 1)
    cookies.set(name, value)
  }
  return cookies
}

function decodeCookieValue(value: string | undefined): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function extractTokenFromSupabaseAuthCookie(raw: string | undefined): string | null {
  const decoded = decodeCookieValue(raw)
  if (!decoded) return null

  try {
    const parsed = JSON.parse(decoded)
    if (typeof parsed === "string") return parsed
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0]
    if (parsed && typeof parsed === "object") {
      if (typeof (parsed as { access_token?: unknown }).access_token === "string") {
        return (parsed as { access_token: string }).access_token
      }
      if (typeof (parsed as { currentSession?: { access_token?: unknown } }).currentSession?.access_token === "string") {
        return (parsed as { currentSession: { access_token: string } }).currentSession.access_token
      }
    }
  } catch {
    // no-op
  }

  return decoded || null
}

export function getAccessTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim()
    if (bearer) return bearer
  }

  const cookies = parseCookieHeader(req.headers.get("cookie"))

  const directToken = decodeCookieValue(cookies.get("sb-access-token"))
  if (directToken) return directToken

  for (const [name, value] of cookies.entries()) {
    if (name.endsWith("-auth-token")) {
      const token = extractTokenFromSupabaseAuthCookie(value)
      if (token) return token
    }
  }

  return null
}

export async function getAuthenticatedUserFromRequest(req: Request): Promise<{ id: string; email: string | null; token: string } | null> {
  const authState = await getAuthenticatedUserStateFromRequest(req)
  if (!authState?.emailVerified) return null
  return { id: authState.id, email: authState.email, token: authState.token }
}

export async function getAuthenticatedUserStateFromRequest(
  req: Request
): Promise<{ id: string; email: string | null; token: string; emailVerified: boolean } | null> {
  const token = getAccessTokenFromRequest(req)
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    token,
    emailVerified: isEmailVerified(data.user),
  }
}

async function getProfileById(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, plan, subscribed, trial_ends_at, parent_user_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("⚠️ getProfileById query error:", {
      userId,
      message: error.message,
      code: error.code,
    })
    return null
  }

  return (data as ProfileRow | null) ?? null
}

async function getOptionalSubscriptionStartedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("subscription_started_at")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.warn("⚠️ Optional subscription_started_at lookup failed:", {
      userId,
      message: error.message,
      code: error.code,
    })
    return null
  }

  return (data as SubscriptionStartedAtRow | null)?.subscription_started_at ?? null
}

async function autoRepairMissingProfile(userId: string): Promise<void> {
  try {
    const existingProfile = await getProfileById(userId)
    if (existingProfile && (existingProfile.plan || existingProfile.subscribed)) return

    const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (authUserError || !authUserData?.user) {
      console.warn("⚠️ Failed to load auth user for profile auto-repair:", userId, authUserError?.message ?? "not_found")
      return
    }

    const trialEndsAt = new Date(Date.now() + PROFILE_AUTO_REPAIR_TRIAL_DAYS * MS_PER_DAY).toISOString()
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: authUserData.user.email ?? null,
          plan: "trial",
          subscribed: false,
          trial_ends_at: trialEndsAt,
        },
        { onConflict: "id", ignoreDuplicates: false }
      )

    if (upsertError) {
      console.warn("⚠️ Failed to auto-repair missing profile:", userId, upsertError.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("⚠️ Unexpected profile auto-repair failure:", userId, message)
  }
}

export async function getBillingAccessDecision(userId: string): Promise<BillingAccessDecision> {
  let userProfile = await getProfileById(userId)

  // A profile row can exist but be incomplete: the handle_new_user() DB
  // trigger inserts a bare (id, email) row the instant someone signs up,
  // before /api/create-profile has a chance to set plan/trial_ends_at. If
  // that step never completes (network error, client bug, tab closed mid
  // signup, etc.), the row is left with plan: null forever. Without this
  // check that reads as "not on trial and not subscribed" and routes the
  // user to /choose-plan instead of giving them the trial they signed up
  // for. Treat a planless row the same as a missing one so it gets repaired.
  if (!userProfile || (!userProfile.plan && !userProfile.subscribed)) {
    await autoRepairMissingProfile(userId)
    userProfile = await getProfileById(userId)
  }

  if (!userProfile) {
    return {
      allowed: false,
      reason: "profile_not_found",
      ownerId: null,
      userProfile: null,
      billingProfile: null,
    }
  }

  const ownerId = userProfile.parent_user_id || userProfile.id
  const billingProfile = ownerId === userProfile.id ? userProfile : await getProfileById(ownerId)

  if (!billingProfile) {
    return {
      allowed: false,
      reason: "profile_not_found",
      ownerId,
      userProfile,
      billingProfile: null,
    }
  }

  if (billingProfile.subscribed) {
    const subscriptionStartedAt = await getOptionalSubscriptionStartedAt(ownerId)
    const hydratedBillingProfile: ProfileRow = {
      ...billingProfile,
      subscription_started_at: subscriptionStartedAt,
    }
    return {
      allowed: true,
      reason: "ok",
      ownerId,
      userProfile,
      billingProfile: hydratedBillingProfile,
    }
  }

  const hasActiveTrial =
    billingProfile.plan === "trial" &&
    !!billingProfile.trial_ends_at &&
    new Date(billingProfile.trial_ends_at) >= new Date()

  if (hasActiveTrial) {
    return {
      allowed: true,
      reason: "ok",
      ownerId,
      userProfile,
      billingProfile,
    }
  }

  const reason = billingProfile.plan === "trial" ? "trial_expired" : "payment_required"
  return {
    allowed: false,
    reason,
    ownerId,
    userProfile,
    billingProfile,
  }
}

export async function getAccountUserIds(ownerId: string): Promise<string[]> {
  const { data: subUsers } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("parent_user_id", ownerId)
  return [ownerId, ...(subUsers || []).map((u: { id: string }) => u.id)]
}
