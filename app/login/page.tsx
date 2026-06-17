"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { isEmailVerified } from "../../lib/emailVerification"

const ACCESS_TOKEN_COOKIE = "sb-access-token"
const MAX_SESSION_RETRY_ATTEMPTS = 3
const SESSION_RETRY_DELAY_MS = 150

export default function LoginPage() {

  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [existingUser, setExistingUser] = useState<{ email: string } | null>(null)

  async function signOutUnverifiedUser(message: string) {
    await supabase.auth.signOut()
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; ${getCookieAttributes(0)}`
    setExistingUser(null)
    setLoginError(message)
  }

  function getCookieAttributes(maxAgeSeconds: number) {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
    return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
  }

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (data.user && !isEmailVerified(data.user)) {
        await signOutUnverifiedUser("Please verify your email before logging in.")
        return
      }

      // ✅ KEY FIX: DO NOT redirect if coming from signup/payment
      const fromSignup = searchParams.get("fromSignup")

      if (data.user && !fromSignup) {
        setExistingUser({ email: data.user.email ?? "" })
        try {
          await goToDashboard()
        } catch (error) {
          // Fallback: keep banner visible so user can continue manually.
          console.error("Auto-redirect to dashboard failed:", error)
        }
        return
      }
    }

    checkSession()
  }, [router, searchParams])

  useEffect(() => {
    if (searchParams.get("error") === "email_not_confirmed") {
      setLoginError("Please verify your email before accessing the dashboard.")
    }
  }, [searchParams])

  async function goToDashboard(accessToken?: string) {
    let token = accessToken
    if (!token) {
      for (let attempt = 0; attempt < MAX_SESSION_RETRY_ATTEMPTS && !token; attempt++) {
        const { data: sessionData } = await supabase.auth.getSession()
        token = sessionData.session?.access_token
        if (!token && attempt < MAX_SESSION_RETRY_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAY_MS))
        }
      }
    }
    if (token) {
      document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(3600)}`
    }

    // Always navigate to dashboard — all billing gates (subscribed check,
    // expired trial, unpaid paid-plan, etc.) are enforced there with retry
    // logic. Duplicating the checks here creates stale-data races and misses
    // the polling safety-net that the dashboard provides.
    const fromPayment = searchParams.get("fromPayment")
    const sessionId = searchParams.get("session_id")
    const params = new URLSearchParams()
    if (fromPayment) params.set("fromPayment", fromPayment)
    if (sessionId) params.set("session_id", sessionId)
    const qs = params.toString()
    router.push(qs ? `/dashboard?${qs}` : "/dashboard")
  }

  async function handleLogin(e: any) {
    e.preventDefault()
    setLoading(true)
    setLoginError("")

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setLoginError(error.message)
      setLoading(false)
      return
    }

    if (data.user && !isEmailVerified(data.user)) {
      await signOutUnverifiedUser("Please verify your email before logging in.")
      setLoading(false)
      return
    }

    await goToDashboard(data.session?.access_token)
    setLoading(false)
  }

  async function handleContinueToDashboard() {
    try {
      await goToDashboard()
    } catch {
      setLoginError("Could not continue to dashboard. Please try logging in again.")
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 20,
      }}
    >

      {/* LOGO */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img className="dashboard-logo" src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
      </div>

      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "white",
          padding: 40,
          borderRadius: 20,
          boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
        }}
      >

        {existingUser && (
          <div style={{
            background: "#EEF2FF",
            border: "1px solid #C7D2FE",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#3730A3", fontWeight: 500 }}>
              You are already signed in as <strong>{existingUser.email}</strong>
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={handleContinueToDashboard}
                style={{
                  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                  color: "#fff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Continue to Dashboard
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  document.cookie = `${ACCESS_TOKEN_COOKIE}=; ${getCookieAttributes(0)}`
                  setExistingUser(null)
                }}
                style={{
                  background: "#fff",
                  color: "#374151",
                  border: "1.5px solid #E5E7EB",
                  padding: "10px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Sign in with a different account
              </button>
            </div>
          </div>
        )}

        {/* TITLE */}
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          marginBottom: 20,
          textAlign: "center",
        }}>
          Welcome back
        </h1>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginTop: -6 }}>
            <a href="/forgot-password" style={{
              fontSize: 13,
              color: "#6A11CB",
              fontWeight: 500,
            }}>
              Forgot password?
            </a>
          </div>

          {/* BUTTON */}
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
              opacity: loading ? 0.8 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >

            {loading && (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid white",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            )}

            {loading ? "Logging in..." : "Log in"}

          </button>

        </form>

        {loginError && (
          <div style={{
            marginTop: 14,
            padding: "12px 16px",
            background: "#FEF3C7",
            borderRadius: 10,
            border: "1px solid #F59E0B",
            fontSize: 13,
            color: "#92400E",
          }}>
            <p style={{ margin: "0 0 6px 0", fontWeight: 600 }}>{loginError}</p>
            <p style={{ margin: 0 }}>
              Check your password and try again, or use{" "}
              <a href="/forgot-password" style={{ color: "#6A11CB", fontWeight: 600 }}>
                Forgot password?
              </a>{" "}
              to reset your credentials.
            </p>
          </div>
        )}

        <p style={{
          fontSize: 13,
          color: "#6B7280",
          marginTop: 20,
          textAlign: "center",
        }}>
          Don’t have an account?{" "}
          <a href="/signup" style={{ color: "#6A11CB", fontWeight: 600 }}>
            Sign up
          </a>
        </p>

      </div>

      {/* Spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

    </main>
  )
}
