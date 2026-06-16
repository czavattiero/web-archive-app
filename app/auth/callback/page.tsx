"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { completeSignupSetup } from "../../../lib/completeSignupSetup"
import { supabase } from "../../../lib/supabase"

const CALLBACK_TIMEOUT_MS = 10_000
type SignupPlan = "trial" | "basic" | "pro"
type AuthSession = NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>

function isSignupPlan(value: string): value is SignupPlan {
  return value === "trial" || value === "basic" || value === "pro"
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedRef = useRef(false)
  const completedRef = useRef(false)
  const plan = searchParams.get("plan") || "trial"
  const safePlan: SignupPlan = isSignupPlan(plan) ? plan : "trial"

  useEffect(() => {
    function redirectToSignup(linkError?: string) {
      if (redirectedRef.current) return
      redirectedRef.current = true
      const params = new URLSearchParams({ plan: safePlan })
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
          plan: safePlan,
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
    if (hashErrorCode || hashError) {
      redirectToSignup(hashErrorCode || hashError || "verification_failed")
      return
    }

    const timeoutId = setTimeout(() => {
      if (completedRef.current) return
      redirectToSignup("session_timeout")
    }, CALLBACK_TIMEOUT_MS)

    const subRef: { current: { unsubscribe: () => void } | null } = { current: null }

    void supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (sessionData.session) {
        clearTimeout(timeoutId)
        subRef.current?.unsubscribe()
        await finishSignup(sessionData.session)
      }
    })

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
  }, [router, safePlan])

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
