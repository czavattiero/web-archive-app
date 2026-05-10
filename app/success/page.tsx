"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

export default function SuccessPage() {

  const params = useSearchParams()
  const router = useRouter()

  useEffect(() => {

    async function verify() {

      const sessionId = params.get("session_id")

      if (!sessionId) {
        router.push("/dashboard")
        return
      }

      try {
        await fetch("/api/verify-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            session_id: sessionId
          })
        })
      } catch (error) {
        console.error("verify-session failed on success page:", error)
      }
      router.push(`/dashboard?fromPayment=true&session_id=${encodeURIComponent(sessionId)}`)

    }

    verify()

  }, [params, router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Finalizing your subscription...</p>
    </div>
  )
}
