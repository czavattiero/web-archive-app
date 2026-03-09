"use client"

import { useSearchParams } from "next/navigation"

export default function SignupPage() {

  const searchParams = useSearchParams()

  const plan = searchParams.get("plan")

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f7f8fb",
        fontFamily: "system-ui, sans-serif",
      }}
    >

      <div
        style={{
          background: "white",
          padding: 40,
          borderRadius: 12,
          width: 400,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        }}
      >

        <h1 style={{ fontSize: 24, marginBottom: 20 }}>
          Create your account
        </h1>

        <p style={{ marginBottom: 20, color: "#666" }}>
          Selected plan: <strong>{plan}</strong>
        </p>

        <form>

          <div style={{ marginBottom: 15 }}>
            <input
              type="email"
              placeholder="Email"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              placeholder="Password"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 6,
                border: "1px solid #ddd",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: "100%",
              background: "#5B4DFF",
              color: "white",
              padding: 12,
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Continue to payment
          </button>

        </form>

      </div>

    </main>
  )
}
