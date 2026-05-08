"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function ResetPasswordPage() {

  const router = useRouter()

  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleUpdate(e: any) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage("Password updated! Redirecting...")

    setTimeout(() => {
      router.push("/login")
    }, 2000)
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f7f8fb"
    }}>
      <div style={{
        maxWidth: 400,
        width: "100%",
        background: "white",
        padding: 40,
        borderRadius: 20,
        boxShadow: "0 20px 50px rgba(0,0,0,0.1)"
      }}>

        <h1 style={{ marginBottom: 20 }}>Set new password</h1>

        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            style={{ padding: 12 }}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        {message && <p style={{ marginTop: 15 }}>{message}</p>}

      </div>
    </main>
  )
}
