"use client"

import { useState } from "react"
import { supabase } from "../../lib/supabase"

export default function ForgotPasswordPage() {

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleReset(e: any) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    setMessage("Check your email for the reset link.")
    setLoading(false)
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
        width: 400,
        background: "white",
        padding: 40,
        borderRadius: 20,
        boxShadow: "0 20px 50px rgba(0,0,0,0.1)"
      }}>

        <h1 style={{ marginBottom: 20 }}>Reset password</h1>

        <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            style={{ padding: 12 }}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message && <p style={{ marginTop: 15 }}>{message}</p>}

      </div>
    </main>
  )
}
