"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"

const VALID_PLANS = new Set(["trial", "basic", "pro"])

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedRef = useRef(false)
  const plan = searchParams.get("plan") || "trial"
  const safePlan = VALID_PLANS.has(plan) ? plan : "trial"

  useEffect(() => {
    function redirectToSignup() {
      if (redirectedRef.current) return
      redirectedRef.current = true
      router.replace(`/signup?confirmed=true&plan=${encodeURIComponent(safePlan)}`)
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        redirectToSignup()
      }
    })

    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (sessionData.session) {
        redirectToSignup()
      }
    })

    return () => data.subscription.unsubscribe()
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
        <p style={{ color: "#6B7280" }}>Confirming your account…</p>
      </div>
    </main>
  )
}
