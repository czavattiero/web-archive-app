"use client"

import { useEffect, useState } from "react"

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
  const [invalid, setInvalid] = useState(false)
  // Holds the decoded OTP URL once the hash is parsed.  Until then the button
  // is not shown so scanners that execute JS cannot trigger the redirect
  // automatically — only an explicit user click will consume the token.
  const [otpUrl, setOtpUrl] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    if (!hash) {
      setInvalid(true)
      return
    }

    // Validate the decoded URL: it must point to the configured Supabase project
    // to prevent an open-redirect attack where a crafted hash could send users
    // to an arbitrary domain.
    let decoded: string
    try {
      decoded = decodeURIComponent(hash)
      const parsed = new URL(decoded)
      const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin
      if (parsed.origin !== supabaseOrigin) {
        setInvalid(true)
        return
      }
    } catch {
      setInvalid(true)
      return
    }

    // Store the URL so we can redirect only on an explicit button click.
    // Email security scanners that execute JS will run this effect, but they
    // do not simulate button clicks, so the one-time token is preserved for
    // the real user.
    setOtpUrl(decoded)
  }, [])

  function handleConfirm() {
    if (!otpUrl) return
    setVerifying(true)
    window.location.href = otpUrl
  }

  if (invalid) {
    return (
      <PageShell>
        <p style={{ color: "#EF4444", fontWeight: 600, marginBottom: 8 }}>Invalid verification link</p>
        <p style={{ color: "#6B7280", fontSize: 14 }}>
          This link is missing required information. Please use the link from your confirmation email or{" "}
          <a href="/signup" style={{ color: "#6A11CB" }}>sign up again</a>.
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

  if (otpUrl) {
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
