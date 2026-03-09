"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function SuccessPage() {

  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {

    const sessionId = searchParams.get("session_id")

    if (!sessionId) {
      router.push("/")
      return
    }

    async function verify() {

      const res = await fetch("/api/verify-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      })

      const data = await res.json()

      if (!data.success) {
        router.push("/")
        return
      }

      router.push("/dashboard")
    }

    verify()

  }, [searchParams, router])

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui",
      }}
    >
      <h1>Payment successful. Setting up your dashboard...</h1>
    </main>
  )
}
