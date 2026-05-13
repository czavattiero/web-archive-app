"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

const ACCESS_TOKEN_COOKIE = "sb-access-token"

const PROFILE_READY_MAX_RETRIES = 5
const PROFILE_READY_RETRY_DELAY_MS = 500

function getCookieAttributes(maxAgeSeconds: number) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
  return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
}

export default function AccountSetupPage() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")

  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const startedRef = useRef(false)

  useEffect(() => {
    // If the middleware surfaced an error after exhausting retries, show it immediately.
    if (errorParam === "profile_propagation_failed") {
      setErrorMessage("We couldn't set up your account. Please contact support.")
      setStatus("error")
      return
    }

    // Guard against double-invocation in React Strict Mode.
    if (startedRef.current) return
    startedRef.current = true

    async function run() {
      // Verify the user is authenticated.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        window.location.href = "/login"
        return
      }

      const { user } = session
      const token = session.access_token

      // Persist the access token cookie so API routes can read it.
      document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(3600)}`

      // Create / repair the profile via the existing API endpoint.
      const profileRes = await fetch("/api/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          plan: "trial",
          trialEndsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      })

      if (!profileRes.ok) {
        const profileData = await profileRes.json()
        console.error("Account setup — profile creation error:", profileData.error)
        setErrorMessage("We couldn't set up your account. Please contact support.")
        setStatus("error")
        return
      }

      // Poll the profiles table until the row is visible (handles replication lag).
      let profileReady = false
      for (let attempt = 0; attempt < PROFILE_READY_MAX_RETRIES; attempt++) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle()

        if (profile?.id) {
          profileReady = true
          break
        }
        if (profileError) {
          console.warn("Account setup — profile readiness check failed:", profileError.message)
        }

        if (attempt < PROFILE_READY_MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, PROFILE_READY_RETRY_DELAY_MS))
        }
      }

      if (!profileReady) {
        console.warn("Account setup — profile readiness check exhausted retries; redirecting to /dashboard anyway")
      }

      window.location.href = "/dashboard"
    }

    run().catch((err) => {
      console.error("Account setup error:", err)
      setErrorMessage("We couldn't set up your account. Please contact support.")
      setStatus("error")
    })
  }, [errorParam])

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
        {status === "error" ? (
          <p style={{ color: "red" }}>{errorMessage}</p>
        ) : (
          <p style={{ color: "#6B7280" }}>Setting up your account…</p>
        )}
      </div>
    </main>
  )
}
