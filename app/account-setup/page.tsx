"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

const ACCESS_TOKEN_COOKIE = "sb-access-token"
const TRIAL_DURATION_MS = 15 * 24 * 60 * 60 * 1000

function getCookieAttributes(maxAgeSeconds: number) {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; secure"
      : ""
  return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
}

export default function AccountSetupPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const errorParam = searchParams.get("error")

  const [error, setError] = useState<string | null>(
    errorParam === "profile_propagation_failed"
      ? "We were unable to set up your account after several attempts. Please contact support."
      : null
  )

  useEffect(() => {
    if (errorParam === "profile_propagation_failed") return

    let cancelled = false

    async function repairProfile() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          if (!cancelled) {
            router.replace("/login")
          }
          return
        }

        const { user, access_token: token } = session

        document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(3600)}`

        const profileRes = await fetch("/api/create-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            plan: "trial",
            trialEndsAt: new Date(Date.now() + TRIAL_DURATION_MS).toISOString(),
          }),
        })

        if (!profileRes.ok) {
          const data = await profileRes.json()
          console.error("Account setup: profile creation error:", data.error)
          if (!cancelled) {
            setError(
              "Failed to set up your account. Please try refreshing or contact support."
            )
          }
          return
        }

        if (!cancelled) {
          router.replace("/dashboard")
        }
      } catch (err) {
        console.error("Account setup error:", err)
        if (!cancelled) {
          setError(
            "Something went wrong while setting up your account. Please try refreshing."
          )
        }
      }
    }

    repairProfile()

    return () => {
      cancelled = true
    }
  }, [errorParam, router])

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    padding: 20,
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 420,
    width: "100%",
    background: "white",
    padding: 40,
    borderRadius: 20,
    boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
    textAlign: "center",
  }

  if (error) {
    return (
      <main style={containerStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            className="dashboard-logo"
            src="/Timedshot-logo.png"
            alt="Timedshot logo"
            style={{ height: 160 }}
          />
        </div>
        <div style={cardStyle}>
          <p style={{ color: "red", marginBottom: 16 }}>{error}</p>
          <a
            href="/login"
            style={{ color: "#6A11CB", textDecoration: "underline", fontSize: 14 }}
          >
            Return to login
          </a>
        </div>
      </main>
    )
  }

  return (
    <main style={containerStyle}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img
          className="dashboard-logo"
          src="/Timedshot-logo.png"
          alt="Timedshot logo"
          style={{ height: 160 }}
        />
      </div>
      <div style={cardStyle}>
        <p style={{ color: "#6B7280" }}>Setting up your account…</p>
      </div>
    </main>
  )
}
