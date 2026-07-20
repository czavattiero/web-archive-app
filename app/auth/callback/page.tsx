"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { completeSignupSetup } from "../../../lib/completeSignupSetup"
import { supabase } from "../../../lib/supabase"
import { SIGNUP_PLAN_STORAGE_KEY, normalizeSignupPlan, parseSignupPlan, type SignupPlan } from "../../../lib/signupPlan"

const CALLBACK_TIMEOUT_MS = 10_000
type AuthSession = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedRef = useRef(false)
  const completedRef = useRef(false)

  useEffect(() => {
    function getStoredPlan() {
      try {
        return normalizeSignupPlan(window.localStorage.getItem(SIGNUP_PLAN_STORAGE_KEY))
      } catch {
        return "trial"
      }
    }

    function getPlanForSession(session: AuthSession): SignupPlan {
      const metadataPlan = parseSignupPlan(
        typeof session.user.user_metadata?.signup_plan === "string"
          ? session.user.user_metadata.signup_plan
          : null
      )
      const queryPlan = parseSignupPlan(searchParams.get("plan"))
      const storedPlan = getStoredPlan()
      const resolvedPlan = queryPlan ?? storedPlan ?? metadataPlan ?? "trial"
      try {
        window.localStorage.setItem(SIGNUP_PLAN_STORAGE_KEY, resolvedPlan)
      } catch {
        // no-op
      }
      return resolvedPlan
    }

    function redirectToSignup(linkError?: string) {
      if (redirectedRef.current) return
      redirectedRef.current = true
      const params = new URLSearchParams({ plan: getStoredPlan() })
      if (linkError) params.set("linkError", linkError)
      router.replace(`/signup?${params.toString()}`)
    }

    async function finishSignup(session: AuthSession) {
      if (completedRef.current) return
      completedRef.current = true

      try {
        const result = await completeSignupSetup({
          user: session.user,
          accessToken: session.access_token,
          plan: getPlanForSession(session),
        })

        if (result.redirectTo) {
          window.location.href = result.redirectTo
          return
        }
      } catch (error) {
        console.error("Auth callback setup error:", error)
      }

      redirectToSignup("setup_failed")
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""))
    const hashErrorCode = hashParams.get("error_code")
    const hashError = hashParams.get("error")
    // PKCE flow errors arrive as query params; implicit flow errors arrive in the hash
    const queryErrorCode = searchParams.get("error_code")
    const queryError = searchParams.get("error")
    if (hashErrorCode || hashError || queryErrorCode || queryError) {
      redirectToSignup(hashErrorCode || hashError || queryErrorCode || queryError || "verification_failed")
      return
    }

    const timeoutId = setTimeout(() => {
      if (completedRef.current) return
      redirectToSignup("session_timeout")
    }, CALLBACK_TIMEOUT_MS)

    const subRef: { current: { unsubscribe: () => void } | null } = { current: null }

    void (async () => {
      // lib/supabase.ts sets detectSessionInUrl: true, so the Supabase client
      // automatically exchanges any PKCE code (or implicit-flow hash token) in
      // the URL during its async initialization. getSession() awaits that
      // initialization before returning, so calling exchangeCodeForSession()
      // manually here would attempt to consume the code a second time and fail.
      // Instead, just wait for the session that detectSessionInUrl already obtained.
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session) {
        clearTimeout(timeoutId)
        subRef.current?.unsubscribe()
        await finishSignup(sessionData.session)
      }
      // If no session is available after initialization, onAuthStateChange will
      // call finishSignup when SIGNED_IN or INITIAL_SESSION fires. If neither
      // fires within CALLBACK_TIMEOUT_MS the timeout redirects to /signup.
    })()

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        clearTimeout(timeoutId)
        subRef.current?.unsubscribe()
        await finishSignup(session)
      }
    })
    subRef.current = data.subscription

    return () => {
      clearTimeout(timeoutId)
      subRef.current?.unsubscribe()
    }
  }, [router, searchParams])

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: 20,
    }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img className="dashboard-logo" src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
      </div>
      <div style={{
        maxWidth: 420,
        width: "100%",
        background: "white",
        padding: 40,
        borderRadius: 20,
        boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
        textAlign: "center",
      }}>
        <p style={{ color: "#6B7280" }}>Finishing your account setup…</p>
      </div>
    </main>
  )
}
