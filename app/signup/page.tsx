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

  try {
    console.log("1. Starting signup...")

    // Try signup
    const { error: signupError } = await supabase.auth.signUp({
      email,
      password
    })

    console.log("2. Signup result:", signupError)

    // If signup fails because user exists → ignore and continue
    if (signupError && !signupError.message.includes("already registered")) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    // 🔥 ALWAYS LOGIN (this is the key fix)
    console.log("3. Logging in...")

const { error: loginError } =
  await supabase.auth.signInWithPassword({
    email,
    password
  })

if (loginError) {
  setError("Login failed. Try correct password.")
  setLoading(false)
  return
}

// ✅ 🔥 STEP 4 — SAVE USER IN DATABASE
console.log("4. Saving user profile...")

const { data: userData } = await supabase.auth.getUser()

await supabase.from("profiles").upsert({
  id: userData.user?.id,
  email: userData.user?.email,
  subscribed: false
})

console.log("5. Profile saved → calling Stripe")

    // Call Stripe
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        plan
      })
    })

    const data = await res.json()
    console.log("5. Stripe response:", data)

    if (!data.url) {
      setError("Stripe checkout failed")
      setLoading(false)
      return
    }

    console.log("6. Redirecting to Stripe")

    window.location.href = data.url

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
