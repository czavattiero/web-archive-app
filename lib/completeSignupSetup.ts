import type { User } from "@supabase/supabase-js"
import { supabase } from "./supabase"

const ACCESS_TOKEN_COOKIE = "sb-access-token"
const PROFILE_READY_MAX_RETRIES = 5
const PROFILE_READY_RETRY_DELAY_MS = 500

function getCookieAttributes(maxAgeSeconds: number) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
  return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
}

export async function completeSignupSetup({
  user,
  accessToken,
  plan,
}: {
  user: Pick<User, "id" | "email">
  accessToken?: string
  plan: "trial" | "basic" | "pro"
}) {
  let token = accessToken
  if (!token) {
    const { data: sessionData } = await supabase.auth.getSession()
    token = sessionData.session?.access_token
  }

  if (!token) {
    return { error: "Session expired. Please log in again.", redirectTo: null }
  }

  document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(3600)}`

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  }

  const profileRes = await fetch("/api/create-profile", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      plan,
      trialEndsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  })

  if (!profileRes.ok) {
    const profileData = await profileRes.json()
    console.error("Profile creation error:", profileData.error)
    return { error: "Failed to create profile", redirectTo: null }
  }

  if (plan === "basic" || plan === "pro") {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email: user.email, plan, userId: user.id }),
    })
    const data = await res.json()

    if (!data.url) {
      return { error: "Checkout failed", redirectTo: null }
    }

    return { error: null, redirectTo: data.url as string }
  }

  let profileReady = false
  for (let attempt = 0; attempt < PROFILE_READY_MAX_RETRIES; attempt++) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.id) {
      profileReady = true
      break
    }

    if (profileError) {
      console.warn("Profile readiness check failed:", profileError.message)
    }

    if (attempt < PROFILE_READY_MAX_RETRIES - 1) {
      await new Promise(resolve => setTimeout(resolve, PROFILE_READY_RETRY_DELAY_MS))
    }
  }

  if (!profileReady) {
    console.warn("Profile readiness check exhausted retries; redirecting to /dashboard anyway")
  }

  return { error: null, redirectTo: "/dashboard" }
}
