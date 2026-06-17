"use client"

import { useEffect, useState } from "react"

export default function VerifyPage() {
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) {
      setInvalid(true)
      return
    }

    let otpUrl: string
    try {
      otpUrl = decodeURIComponent(hash)
      // Basic sanity check: must parse as an absolute URL
      new URL(otpUrl)
    } catch {
      setInvalid(true)
      return
    }

    // Navigate to the Supabase OTP link — scanners never reach here because
    // they make plain GET requests (no JS execution) and the fragment is never
    // sent to the server, so the one-time token is preserved for the real user.
    window.location.href = otpUrl
  }, [])

  if (invalid) {
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
          <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
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
          <p style={{ color: "#EF4444", fontWeight: 600, marginBottom: 8 }}>Invalid verification link</p>
          <p style={{ color: "#6B7280", fontSize: 14 }}>
            This link is missing required information. Please use the link from your confirmation email or{" "}
            <a href="/signup" style={{ color: "#6A11CB" }}>sign up again</a>.
          </p>
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
        <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
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
        <p style={{ color: "#6B7280" }}>Verifying your email…</p>
      </div>
    </main>
  )
}
