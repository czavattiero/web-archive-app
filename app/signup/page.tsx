"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { completeSignupSetup } from "../../lib/completeSignupSetup"
import { supabase } from "../../lib/supabase"

// If neither an existing session nor a SIGNED_IN / INITIAL_SESSION event
// arrives within this window after the confirmed=true redirect, send the
// user back to the login page rather than leaving them on an infinite spinner.
const CONFIRMATION_TIMEOUT_MS = 10_000

export default function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "trial"
  const safePlan = plan === "basic" || plan === "pro" ? plan : "trial"
  const isConfirmed = searchParams.get("confirmed") === "true"
  const linkError = searchParams.get("linkError")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checkEmail, setCheckEmail] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState("")
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState("")
  const [resendEmail, setResendEmail] = useState("")
  const completedRef = useRef(false)

  function getLinkErrorMessage(code: string | null) {
    switch (code) {
      case "otp_expired":
      case "access_denied":
        return "That verification link is no longer valid. Request a fresh confirmation email below and use only the newest link."
      case "session_timeout":
        return "We couldn't finish verifying your account from that link. Request a new confirmation email below or log in if your account was already confirmed."
      case "setup_failed":
        return "Your email may have been confirmed, but we couldn't finish setting up the account. Try logging in, or request a new confirmation email if needed."
      case "verification_failed":
        return "We couldn't verify that email link. Request a new confirmation email below."
      default:
        return ""
    }
  }

  // Shared post-confirmation setup: upsert profile then redirect.
  // Guarded by completedRef so it runs at most once even if both the
  // eager session check and the auth-state listener fire.
  const completeSetup = useCallback(async (user: { id: string; email?: string | null }, accessToken?: string) => {
    if (completedRef.current) return
    completedRef.current = true

    setLoading(true)
    setError("")

    try {
      const result = await completeSignupSetup({
        user,
        accessToken,
        plan: safePlan,
      })

      if (result.redirectTo) {
        window.location.href = result.redirectTo
        return
      }

      completedRef.current = false
      setError(result.error || "Something went wrong")
      setLoading(false)
    } catch (err) {
      completedRef.current = false
      console.error("Post-confirmation error:", err)
      setError("Something went wrong")
      setLoading(false)
    }
  }, [safePlan])

  // When the user returns from clicking their confirmation email link,
  // first check whether a session is already present (detectSessionInUrl
  // may have exchanged the token before this effect runs), then fall back
  // to onAuthStateChange in case the exchange happens slightly later.
  // We listen for both SIGNED_IN and INITIAL_SESSION: Supabase fires
  // INITIAL_SESSION (not SIGNED_IN) when a session already exists in
  // localStorage at subscription time, which is the common case after the
  // /auth/callback redirect has already exchanged the token.
  useEffect(() => {
    if (!isConfirmed) return

    setLoading(true)

    const subRef: { current: { unsubscribe: () => void } | null } = { current: null }

    const timeoutId = setTimeout(() => {
      if (completedRef.current) return
      subRef.current?.unsubscribe()
      console.warn("Confirmation session timeout — redirecting to /login")
      router.replace("/login?error=session_timeout")
    }, CONFIRMATION_TIMEOUT_MS)

    async function run() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        clearTimeout(timeoutId)
        completeSetup(session.user, session.access_token)
        return
      }

      const { data } = supabase.auth.onAuthStateChange(async (event, s) => {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s?.user) {
          clearTimeout(timeoutId)
          subRef.current?.unsubscribe()
          completeSetup(s.user, s.access_token)
        }
      })
      subRef.current = data.subscription
    }

    run().catch((err) => {
      clearTimeout(timeoutId)
      console.error("Confirmation setup error:", err)
      setError("Something went wrong")
      setLoading(false)
    })

    return () => {
      clearTimeout(timeoutId)
      subRef.current?.unsubscribe()
    }
  }, [isConfirmed, completeSetup, router])

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

      const succeeded = data.ok === true
      if (!res.ok || data.error || !succeeded) {
        setError(data.error || "Failed to send confirmation email. Please try again.")
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

  async function resendConfirmation(targetEmail: string) {
    if (!targetEmail) {
      setResendMessage("Enter your email address to resend the confirmation email.")
      return
    }

    setResendLoading(true)
    setResendMessage("")

    try {
      const res = await fetch("/api/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, plan }),
      })

      const data = await res.json()

      if (!res.ok || data.error || !data.ok) {
        setResendMessage("Failed to resend. Please try again.")
      } else {
        setSubmittedEmail(targetEmail)
        setResendMessage("Confirmation email resent. Use the newest email link only—older links are invalidated when you request a new confirmation email.")
      }
    } catch {
      setResendMessage("Failed to resend. Please try again.")
    }

    setResendLoading(false)
  }

  async function handleResend() {
    await resendConfirmation(submittedEmail)
  }

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

          <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 8 }}>
            Only the newest confirmation email works—older links are invalidated when you request a new confirmation email.
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
              color: resendMessage.startsWith("Failed") || resendMessage.startsWith("Enter") ? "red" : "#059669",
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

        {getLinkErrorMessage(linkError) && (
          <div style={{
            marginBottom: 20,
            borderRadius: 12,
            border: "1px solid #F59E0B",
            background: "#FFFBEB",
            padding: 16,
          }}>
            <p style={{ margin: "0 0 10px", color: "#92400E", fontSize: 14, fontWeight: 600 }}>
              Verification link issue
            </p>
            <p style={{ margin: "0 0 14px", color: "#92400E", fontSize: 14, lineHeight: 1.5 }}>
              {getLinkErrorMessage(linkError)}
            </p>
            <input
              type="email"
              placeholder="Enter your email to resend"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #FCD34D",
                fontSize: 14,
                marginBottom: 10,
              }}
            />
            <button
              type="button"
              onClick={() => void resendConfirmation(resendEmail)}
              disabled={resendLoading}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                color: "white",
                border: "none",
                padding: "12px 18px",
                borderRadius: 12,
                fontWeight: 600,
                cursor: resendLoading ? "not-allowed" : "pointer",
                opacity: resendLoading ? 0.7 : 1,
                fontSize: 14,
                marginBottom: 10,
              }}
            >
              {resendLoading ? "Sending…" : "Resend confirmation email"}
            </button>
            <a
              href="/login"
              style={{
                display: "block",
                textAlign: "center",
                color: "#6A11CB",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Go to login
            </a>
            {resendMessage && (
              <p style={{
                margin: "12px 0 0",
                fontSize: 13,
                color: resendMessage.startsWith("Failed") || resendMessage.startsWith("Enter") ? "#B91C1C" : "#059669",
              }}>
                {resendMessage}
              </p>
            )}
          </div>
        )}

        {(plan !== "basic" && plan !== "pro") && (
          <p style={{ textAlign: "center", color: "#6B7280", marginBottom: 16, fontSize: 14 }}>
            15-day free trial · No credit card required
          </p>
        )}

        <form onSubmit={handleSignup} style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
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
              opacity: loading ? 0.7 : 1,
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
