"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SIGNUP_PLAN_STORAGE_KEY, normalizeSignupPlan } from "../../lib/signupPlan"

const LOGO_PATH = "/Timedshot-logo.png"

function PageShell({ children }: { children: React.ReactNode }) {
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
        <img src={LOGO_PATH} alt="Timedshot logo" style={{ height: 160 }} />
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
        {children}
      </div>
    </main>
  )
}

export default function VerifyPage() {
  const searchParams = useSearchParams()
  const [invalid, setInvalid] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>("")
  // Holds the verification token extracted from the hash
  const [verificationToken, setVerificationToken] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const safePlan = normalizeSignupPlan(searchParams.get("plan"))

  useEffect(() => {
    try {
      window.localStorage.setItem(SIGNUP_PLAN_STORAGE_KEY, safePlan)
    } catch {
      // no-op
    }

    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) {
      setInvalid(true)
      setErrorMessage("This link is missing required information.")
      return
    }

    // The hash now contains a verification token (not a full URL)
    // Old format (URL-encoded OTP URL) might still exist for backwards compatibility
    const isOldFormat = hash.includes("%") || hash.startsWith("http")
    
    if (isOldFormat) {
      // Backwards compatibility: handle old URL-based format
      try {
        const decoded = decodeURIComponent(hash)
        const parsed = new URL(decoded)
        const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin
        if (parsed.origin !== supabaseOrigin) {
          setInvalid(true)
          setErrorMessage("Invalid verification link.")
          return
        }
        // For old format, redirect directly (legacy behavior)
        window.location.href = decoded
        return
      } catch {
        setInvalid(true)
        setErrorMessage("Invalid verification link format.")
        return
      }
    }

    // New format: store the token for exchange
    setVerificationToken(hash)
  }, [safePlan])

  async function handleConfirm() {
    if (!verificationToken) return
    setVerifying(true)

    try {
      try {
        window.localStorage.setItem(SIGNUP_PLAN_STORAGE_KEY, safePlan)
      } catch {
        // no-op
      }

      // Exchange the token for the actual OTP URL
      const response = await fetch('/api/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      })

      if (!response.ok) {
        const data = await response.json()
        setVerifying(false)
        setInvalid(true)
        setErrorMessage(data.error || "Failed to verify your email. The link may have expired or already been used.")
        return
      }

      const { otpUrl } = await response.json()
      
      // Redirect to the Supabase OTP URL
      window.location.href = otpUrl
    } catch (error) {
      console.error('Token exchange error:', error)
      setVerifying(false)
      setInvalid(true)
      setErrorMessage("Failed to verify your email. Please try again.")
    }
  }

  if (invalid) {
    return (
      <PageShell>
        <p style={{ color: "#EF4444", fontWeight: 600, marginBottom: 8 }}>Verification failed</p>
        <p style={{ color: "#6B7280", fontSize: 14 }}>
          {errorMessage || "This link is invalid or has expired."} Please{" "}
          <a href="/signup" style={{ color: "#6A11CB" }}>sign up again</a> or{" "}
          <a href="/login" style={{ color: "#6A11CB" }}>request a new verification email</a>.
        </p>
      </PageShell>
    )
  }

  if (verifying) {
    return (
      <PageShell>
        <p style={{ color: "#6B7280" }}>Verifying your email…</p>
      </PageShell>
    )
  }

  if (verificationToken) {
    return (
      <PageShell>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: "#111" }}>
          Confirm your email
        </h1>
        <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
          Click the button below to verify your email address and activate your Timedshot account.
        </p>
        <button
          onClick={handleConfirm}
          style={{
            background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
            color: "white",
            border: "none",
            padding: "14px 32px",
            borderRadius: 12,
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            width: "100%",
          }}
        >
          Confirm my email →
        </button>
      </PageShell>
    )
  }

  // Hash not yet parsed (brief moment before useEffect runs)
  return (
    <PageShell>
      <p style={{ color: "#6B7280" }}>Loading…</p>
    </PageShell>
  )
}
