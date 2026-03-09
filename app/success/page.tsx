"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

export default function SuccessPage() {

  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {

    const sessionId = params.get("session_id")

    if (!sessionId) {
      router.push("/")
      return
    }

    async function verifyPayment() {

      const res = await fetch("/api/verify-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId
        })
      })

      const data = await res.json()

      if (!data.success) {
        router.push("/")
        return
      }

      router.push("/dashboard")

    }

    verifyPayment()

  }, [params, router])

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui"
      }}
    >
      <h2>Payment successful. Preparing your dashboard...</h2>
    </main>
  )
}
