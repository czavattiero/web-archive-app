"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SignupClient() {

  const params = useSearchParams()
  const plan = params.get("plan")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignup = async () => {

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    // call stripe checkout API
    const res = await fetch("/api/checkout", {
      method: "POST"
    })

    const checkout = await res.json()

    if (!checkout.url) {
      alert("Stripe checkout failed")
      setLoading(false)
      return
    }

    // redirect to stripe
    window.location.href = checkout.url
  }

  return (
    <div style={{ padding: "40px" }}>

      <h1>Create your account</h1>

      {plan && (
        <p>
          Selected plan: <strong>{plan}</strong>
        </p>
      )}

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br/><br/>

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br/><br/>

      <button onClick={handleSignup} disabled={loading}>
        {loading ? "Creating..." : "Create Account"}
      </button>

    </div>
  )
}
