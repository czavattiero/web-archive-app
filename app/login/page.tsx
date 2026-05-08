"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {

  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser()

      // ✅ KEY FIX: DO NOT redirect if coming from signup/payment
      const fromSignup = searchParams.get("fromSignup")

      if (data.user && !fromSignup) {
        router.push("/dashboard")
      }
    }

    checkSession()
  }, [router, searchParams])

  async function handleLogin(e: any) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    setLoading(false)
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 20,
      }}
    >

      {/* LOGO */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img className="dashboard-logo" src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />
      </div>

      <div
        style={{
          maxWidth: 420,
          width: "100%",
          background: "white",
          padding: 40,
          borderRadius: 20,
          boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
        }}
      >

        {/* TITLE */}
        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          marginBottom: 20,
          textAlign: "center",
        }}>
          Welcome back
        </h1>

        {/* FORM */}
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginTop: -6 }}>
            <a href="/forgot-password" style={{
              fontSize: 13,
              color: "#6A11CB",
              fontWeight: 500,
            }}>
              Forgot password?
            </a>
          </div>

          {/* BUTTON */}
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
              opacity: loading ? 0.8 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >

            {loading && (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid white",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            )}

            {loading ? "Logging in..." : "Log in"}

          </button>

        </form>

        <p style={{
          fontSize: 13,
          color: "#6B7280",
          marginTop: 20,
          textAlign: "center",
        }}>
          Don’t have an account?{" "}
          <a href="/signup" style={{ color: "#6A11CB", fontWeight: 600 }}>
            Sign up
          </a>
        </p>

      </div>

      {/* Spinner animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

    </main>
  )
}
