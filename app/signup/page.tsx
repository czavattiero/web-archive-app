export default function Signup() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 20,
      }}
    >

      {/* CONTAINER */}
      <div
        style={{
          width: 420,
          background: "white",
          padding: 40,
          borderRadius: 20,
          boxShadow: "0 25px 60px rgba(0,0,0,0.12)",
        }}
      >

        {/* 🔥 LOGO */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img
            src="/screenly-logo.png"
            alt="Screenly"
            style={{
              height: 80,
              marginBottom: 10,
            }}
          />
        </div>

        {/* TITLE */}
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Create your account
        </h1>

        {/* PLAN */}
        <p
          style={{
            textAlign: "center",
            color: "#6B7280",
            marginBottom: 25,
          }}
        >
          Selected plan: <strong style={{ color: "#6A11CB" }}>Pro</strong>
        </p>

        {/* FORM */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <input
            type="email"
            placeholder="Email"
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
            style={{
              padding: "14px",
              borderRadius: 10,
              border: "1px solid #E5E7EB",
              fontSize: 14,
              outline: "none",
            }}
          />

          <button
            style={{
              marginTop: 10,
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "14px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(106,17,203,0.25)",
            }}
          >
            Continue to payment
          </button>

        </div>

        {/* FOOTER TEXT */}
        <p
          style={{
            fontSize: 12,
            color: "#9CA3AF",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Secure checkout powered by Stripe
        </p>

      </div>
    </main>
  )
}
