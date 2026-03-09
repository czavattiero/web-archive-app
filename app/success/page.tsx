"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SuccessPage() {

  const params = useSearchParams()
  const router = useRouter()

  useEffect(() => {

    async function verify() {

      const sessionId = params.get("session_id")

      if (!sessionId) {
        router.push("/")
        return
      }

      const { data: session } = await supabase.auth.getSession()

      if (!session?.session) {
        router.push("/")
        return
      }

      const res = await fetch("/api/verify-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: sessionId
        })
      })

      const result = await res.json()

      if (result.success) {
        router.push("/dashboard")
      } else {
        router.push("/")
      }

    }

    verify()

  }, [])

  return (
    <div className="flex items-center justify-center h-screen">
      <p>Finalizing your subscription...</p>
    </div>
  )
}
