"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function ChoosePlanPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/signup"); return }
      setUser(data.user)
    })
  }, [router])

  async function handleChoosePlan(plan: "basic" | "pro") {
    if (!user) return
    setLoading(plan)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert("Failed to start checkout: " + (data.error || "Unknown error"))
        setLoading(null)
      }
    } catch (err: any) {
      alert("Error: " + err.message)
      setLoading(null)
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
      fontFamily: "system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 40,
    }}>
      <img src="/screenly-logo.png" style={{ height: 60, marginBottom: 32 }} />

      <h1 style={{ fontSize: 30, fontWeight: 800, textAlign: "center" }}>
        Your free trial has ended
      </h1>
      <p style={{ color: "#6B7280", marginTop: 10, marginBottom: 48, textAlign: "center" }}>
        Choose a plan to continue using Screenly
      </p>

      <div style={{ display: "flex", gap: 32 }}>
        {/* BASIC */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>Basic</h3>
          <p style={{ fontSize: 36, fontWeight: 800, margin: "12px 0 4px" }}>$15</p>
          <p style={{ color: "#6B7280", marginBottom: 20 }}>per month</p>
          <ul style={{ listStyle: "none", padding: 0, lineHeight: 2, color: "#374151" }}>
            <li>✓ 15 URLs per 30 days</li>
            <li>✓ Scheduled captures</li>
            <li>✓ PDF downloads</li>
          </ul>
          <button
            onClick={() => handleChoosePlan("basic")}
            disabled={!!loading}
            style={{ ...btnStyle, background: "#6A11CB", marginTop: 24 }}
          >
            {loading === "basic" ? "Loading..." : "Choose Basic"}
          </button>
        </div>

        {/* PRO */}
        <div style={{ ...cardStyle, border: "2px solid #6A11CB" }}>
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>Professional</h3>
          <p style={{ fontSize: 36, fontWeight: 800, margin: "12px 0 4px" }}>$30</p>
          <p style={{ color: "#6B7280", marginBottom: 20 }}>per month</p>
          <ul style={{ listStyle: "none", padding: 0, lineHeight: 2, color: "#374151" }}>
            <li>✓ 50 URLs per 30 days</li>
            <li>✓ Scheduled captures</li>
            <li>✓ PDF downloads</li>
          </ul>
          <button
            onClick={() => handleChoosePlan("pro")}
            disabled={!!loading}
            style={{ ...btnStyle, background: "linear-gradient(135deg, #6A11CB, #FF7A00)", marginTop: 24 }}
          >
            {loading === "pro" ? "Loading..." : "Choose Professional"}
          </button>
        </div>
      </div>
    </main>
  )
}

const cardStyle = {
  background: "#fff",
  padding: 36,
  borderRadius: 16,
  width: 260,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  textAlign: "center" as const,
}

const btnStyle = {
  width: "100%",
  color: "#fff",
  border: "none",
  padding: "13px 0",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
}
