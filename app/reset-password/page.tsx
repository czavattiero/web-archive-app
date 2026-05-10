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
      background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
      padding: 20,
    }}>
      <div style={{
        maxWidth: 420,
        width: "100%",
        background: "white",
        padding: 40,
        borderRadius: 20,
        boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
      }}>

        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
        </div>

        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 20,
        }}>
          Set new password
        </h1>

        <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        {message && <p style={{ marginTop: 15 }}>{message}</p>}

      </div>
    </main>
  )
}
