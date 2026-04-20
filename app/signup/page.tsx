"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function SignupPage() {

  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "trial"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSignup(e: any) {
    e.preventDefault()

    setLoading(true)
    setError("")

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email,
        password
      })

      if (signupError && !signupError.message.includes("already registered")) {
        setError(signupError.message)
        setLoading(false)
        return
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (loginError) {
        setError("Login failed")
        setLoading(false)
        return
      }

      const { data: userData } = await supabase.auth.getUser()

      if (!userData?.user) {
        setError("User not authenticated")
        setLoading(false)
        return
      }

      await supabase.from("profiles").upsert({
        id: userData.user.id,
        email: userData.user.email,
        subscribed: false,
        plan: "trial",
        trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      })

      if (plan === "basic" || plan === "pro") {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, plan })
        })

        const data = await res.json()

        if (!data.url) {
          setError("Checkout failed")
          setLoading(false)
          return
        }

        window.location.href = data.url
      } else {
        window.location.href = "/dashboard"
      }

    } catch (err) {
      console.error("Signup error:", err)
      setError("Something went wrong")
      setLoading(false)
    }
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

        <h1 style={{
          fontSize: 26,
          fontWeight: 700,
          textAlign: "center",
          marginBottom: 20,
        }}>
          Create your account
        </h1>

        {(plan !== "basic" && plan !== "pro") && (
          <p style={{ textAlign: "center", color: "#6B7280", marginBottom: 16, fontSize: 14 }}>
            15-day free trial · No credit card required
          </p>
        )}

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
            {loading ? "Creating account..." : (plan === "basic" || plan === "pro") ? "Continue to payment" : "Start Free Trial"}
          </button>

        </form>

        {error && (
          <p style={{ color: "red", marginTop: 15 }}>
            {error}
          </p>
        )}

      </div>

    </main>
  )
}
