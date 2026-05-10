"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

const VERIFY_MAX_RETRIES = 5
const VERIFY_RETRY_DELAY_MS = 2000

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

      let confirmed = false
      for (let i = 0; i < VERIFY_MAX_RETRIES; i++) {
        try {
          const res = await fetch("/api/verify-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              session_id: sessionId
            })
          })
          if (res.ok) {
            const result = await res.json()
            if (result.success) {
              confirmed = true
              break
            }
          }
        } catch (error) {
          console.error(`verify-session attempt ${i + 1} failed:`, error)
        }

        if (i < VERIFY_MAX_RETRIES - 1) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, VERIFY_RETRY_DELAY_MS))
        }
      }

      if (!confirmed) {
        console.warn("verify-session did not confirm subscription after retries — redirecting anyway")
      }
      router.push(`/dashboard?fromPayment=true&session_id=${encodeURIComponent(sessionId)}`)

    }

    verify()

  }, [params, router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Finalizing your subscription…</p>
    </div>
  )
}
