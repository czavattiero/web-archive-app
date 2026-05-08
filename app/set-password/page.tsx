"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
/**
 * Set-password page for invited sub-users.
 *
 * When a parent account invites a sub-user via /api/sub-users/invite, Supabase
 * sends the invitee a magic link with type=invite in the URL hash. The invite
 * API sets redirectTo=/set-password and adds needs_password_setup=true to the
 * user's metadata so we can detect this state even after the hash is gone.
 *
 * Flow:
 *  1. Invitee clicks email link → Supabase auto-signs them in and redirects
 *     here with #access_token=...&type=invite in the hash.
 *  2. supabase-js (detectSessionInUrl:true) picks up the token automatically.
 *  3. We read the active session and check for the needs_password_setup flag.
 *  4. If the flag is absent (e.g. a normal user navigating here directly)
 *     we redirect them away.
 *  5. On successful auth.updateUser() the flag is cleared and the user is
 *     sent to the dashboard.
 */
export default function SetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    async function checkSession() {
      // Wait briefly so supabase-js can exchange the invite token from the URL
      // hash before we inspect the session (detectSessionInUrl handles this).
      const { data } = await supabase.auth.getSession()

      if (!data.session) {
        // No active session — not an invited user; send to login.
        router.replace("/login")
        return
      }

      // If the needs_password_setup flag is not set this is not an invite
      // flow, so redirect away to prevent unintended use of this page.
      const needsSetup = data.session.user.user_metadata?.needs_password_setup
      if (!needsSetup) {
        router.replace("/dashboard")
        return
      }

      setChecking(false)
    }

    checkSession()
  }, [router])

  async function handleSubmit(e: any) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)

    // Update the password. Passing the extra metadata field removes the
    // needs_password_setup flag so the dashboard guard lets the user through.
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { needs_password_setup: false },
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setMessage("Password set! Redirecting to your dashboard…")
    setTimeout(() => {
      router.replace("/dashboard")
    }, 1500)
  }

  if (checking) {
    return (
      <main style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f8fb",
        fontFamily: "system-ui, sans-serif",
      }}>
        <p style={{ color: "#6B7280" }}>Verifying invite…</p>
      </main>
    )
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 20,
      }}
    >
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
        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
        </div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          marginBottom: 8,
          textAlign: "center",
        }}>
          Welcome! Set your password
        </h1>

        <p style={{
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          marginBottom: 28,
        }}>
          You've been invited. Please create a password to activate your account.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          {error && (
            <p style={{ color: "#DC2626", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          {message && (
            <p style={{ color: "#16A34A", fontSize: 13, margin: 0 }}>{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
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
            {loading ? "Saving…" : "Set password & continue"}
          </button>
        </form>
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
