"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

const VERIFY_MAX_RETRIES = 5
const VERIFY_RETRY_DELAY_MS = 2000
const VERIFY_REQUEST_TIMEOUT_MS = 8000
const ACCESS_TOKEN_COOKIE = "sb-access-token"

function getCookieAttributes(maxAgeSeconds: number) {
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
  return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
}

export default function SuccessPage() {

  const params = useSearchParams()
  const router = useRouter()

  useEffect(() => {

    async function verify() {

      const sessionId = params.get("session_id")
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error("Failed to load Supabase session on success page:", sessionError)
      }
      const token = sessionData.session?.access_token
      if (token) {
        document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(3600)}`
      }

      if (!sessionId) {
        router.push("/dashboard")
        return
      }

      let confirmed = false
      for (let i = 0; i < VERIFY_MAX_RETRIES; i++) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), VERIFY_REQUEST_TIMEOUT_MS)
        try {
          const res = await fetch("/api/verify-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              session_id: sessionId
            }),
            signal: controller.signal,
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
        } finally {
          clearTimeout(timeoutId)
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Finalizing your subscription…</p>
    </div>
  )
}
