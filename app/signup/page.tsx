"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function SignupPage() {

  const router = useRouter()
  const searchParams = useSearchParams()

  const plan = searchParams.get("plan") || "basic"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSignup(e: any) {
    e.preventDefault()

    setLoading(true)
    setError("")

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // OPTIONAL: handle email confirmation
    if (!data.session) {
      alert("Check your email to confirm your account")
      setLoading(false)
      return
    }

    // Redirect after signup
    router.push(`/dashboard`)
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
          <img src="/screenly-logo.png" style={{ height: 80 }} />
        </div>

        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 10,
        }}>
          Create your account
        </h1>

        <p style={{
          textAlign: "center",
          color: "#6B7280",
          marginBottom: 25,
        }}>
          Selected plan: <strong style={{ color: "#6A11CB" }}>{plan}</strong>
        </p>

        {/* ✅ FORM WRAPPER */}
        <form onSubmit={handleSignup} style={{
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
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
            {loading ? "Creating account..." : "Continue to payment"}
          </button>

        </form>

        {/* ERROR */}
        {error && (
          <p style={{ color: "red", marginTop: 15 }}>
            {error}
          </p>
        )}

        <p style={{
          fontSize: 12,
          color: "#9CA3AF",
          marginTop: 20,
          textAlign: "center",
        }}>
          Secure checkout powered by Stripe
        </p>

      </div>

    </main>
  )
}
