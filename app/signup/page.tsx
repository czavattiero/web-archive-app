"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function SignupPage() {

  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "trial"
  const isConfirmed = searchParams.get("confirmed") === "true"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checkEmail, setCheckEmail] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const completedRef = useRef(false)

  // Shared post-confirmation setup: upsert profile then redirect.
  // Guarded by completedRef so it runs at most once even if both the
  // eager session check and the auth-state listener fire.
  const completeSetup = useCallback(async (user: { id: string; email?: string | null }) => {
    if (completedRef.current) return
    completedRef.current = true

    setLoading(true)
    setError("")

    try {
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        email: user.email,
        subscribed: false,
        plan: "trial",
        trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      })

      if (upsertError) {
        console.error("Profile upsert error:", upsertError)
        setError("Failed to create profile")
        setLoading(false)
        return
      }

      if (plan === "basic" || plan === "pro") {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, plan, userId: user.id }),
        })
        const data = await res.json()

        if (!data.url) {
          setError("Checkout failed")
          setLoading(false)
          return
        }

        window.location.href = data.url
      } else {
        window.location.href = "/dashboard"
      }
    } catch (err) {
      console.error("Post-confirmation error:", err)
      setError("Something went wrong")
      setLoading(false)
    }
  }, [plan])

  // When the user returns from clicking their confirmation email link,
  // first check whether a session is already present (detectSessionInUrl
  // may have exchanged the token before this effect runs), then fall back
  // to onAuthStateChange in case the exchange happens slightly later.
  useEffect(() => {
    if (!isConfirmed) return

    // Show the loading screen immediately so the user sees progress.
    setLoading(true)

    let subscription: { unsubscribe: () => void } | null = null

    async function run() {
      // Eagerly check for an existing session first.
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        completeSetup(session.user)
        return
      }

      // No session yet — subscribe as a fallback for delayed token exchange.
      const { data } = supabase.auth.onAuthStateChange(async (event, s) => {
        if (event === "SIGNED_IN" && s?.user) {
          subscription?.unsubscribe()
          completeSetup(s.user)
        }
      })
      subscription = data.subscription
    }

    run().catch((err) => {
      console.error("Confirmation setup error:", err)
      setError("Something went wrong")
      setLoading(false)
    })

    return () => subscription?.unsubscribe()
  }, [isConfirmed, completeSetup])

  async function handleSignup(e: any) {
    e.preventDefault()

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, plan }),
      })

      const data = await res.json()

      if (data.error && !data.error.includes("already registered")) {
        setError(data.error)
        setLoading(false)
        return
      }

      setSubmittedEmail(email)
      setCheckEmail(true)
      setLoading(false)

    } catch (err) {
      console.error("Signup error:", err)
      setError("Something went wrong")
      setLoading(false)
    }
  }

  async function handleResend() {
    setResendLoading(true)
    setResendMessage("")

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: submittedEmail,
    })

    if (error) {
      setResendMessage("Failed to resend. Please try again.")
    } else {
      setResendMessage("Confirmation email resent! Check your inbox.")
    }

    setResendLoading(false)
  }

  // Show a spinner while processing the confirmed=true redirect
  if (isConfirmed && loading) {
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
          <p style={{ color: "#6B7280" }}>Setting up your account…</p>
        </div>
      </main>
    )
  }

  // Show the "Check your email" confirmation screen
  if (checkEmail) {
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

        {/* LOGO */}
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

          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>

          <h1 style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 12,
          }}>
            Check your email
          </h1>

          <p style={{ color: "#374151", marginBottom: 8, fontSize: 15 }}>
            We sent a confirmation link to:
          </p>

          <p style={{
            fontWeight: 700,
            fontSize: 16,
            color: "#6A11CB",
            marginBottom: 20,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}>
            {submittedEmail}
          </p>

          <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 8 }}>
            Click the link in the email to verify your account.
          </p>

          <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
            {(plan === "basic" || plan === "pro")
              ? "After verification you'll be redirected to complete your payment."
              : "After verification you'll be redirected to your dashboard."}
          </p>

          <button
            onClick={handleResend}
            disabled={resendLoading}
            style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "12px 24px",
              borderRadius: 12,
              fontWeight: 600,
              cursor: resendLoading ? "not-allowed" : "pointer",
              opacity: resendLoading ? 0.7 : 1,
              fontSize: 14,
            }}
          >
            {resendLoading ? "Sending…" : "Resend confirmation email"}
          </button>

          {resendMessage && (
            <p style={{
              marginTop: 14,
              fontSize: 13,
              color: resendMessage.startsWith("Failed") ? "red" : "#059669",
            }}>
              {resendMessage}
            </p>
          )}

        </div>

      </main>
    )
  }

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

      {/* LOGO */}
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
      }}>

        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 20,
        }}>
          Create your account
        </h1>

        {(plan !== "basic" && plan !== "pro") && (
          <p style={{ textAlign: "center", color: "#6B7280", marginBottom: 16, fontSize: 14 }}>
            15-day free trial · No credit card required
          </p>
        )}

        <form onSubmit={handleSignup} style={{
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Creating account..." : (plan === "basic" || plan === "pro") ? "Continue to payment" : "Start Free Trial"}
          </button>

        </form>

        {error && (
          <p style={{ color: "red", marginTop: 15 }}>
            {error}
          </p>
        )}

      </div>

    </main>
  )
}
