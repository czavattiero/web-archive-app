"use client"

import { useState } from "react"
import { supabase } from "../../lib/supabase"

export default function ForgotPasswordPage() {

  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleReset(e: any) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setMessage("")

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "http://localhost:3000/reset-password",
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setMessage("Check your email for the reset link.")
    setLoading(false)
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
        width: 420,
        background: "white",
        padding: 40,
        borderRadius: 20,
        boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
      }}>

        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src="/timedshot-logo-.png" style={{ height: 80 }} />
        </div>

        {/* TITLE */}
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 10,
        }}>
          Reset your password
        </h1>

        <p style={{
          textAlign: "center",
          color: "#6B7280",
          marginBottom: 25,
          fontSize: 14
        }}>
          Enter your email and we’ll send you a reset link
        </p>

        {/* FORM */}
        <form onSubmit={handleReset} style={{
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

        </form>

        {/* MESSAGES */}
        {error && (
          <p style={{ color: "red", marginTop: 15, fontSize: 13 }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ color: "green", marginTop: 15, fontSize: 13 }}>
            {message}
          </p>
        )}

        {/* FOOTER */}
        <p style={{
          fontSize: 13,
          color: "#6A11CB",
          marginTop: 20,
          textAlign: "center",
        }}>
          Back to{" "}
          <a href="/login" style={{ color: "#6A11CB", fontWeight: 600 }}>
            Login
          </a>
        </p>

      </div>

    </main>
  )
}

