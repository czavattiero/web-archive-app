"use client"

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        fontFamily: "system-ui, sans-serif",
        padding: "50px 100px",
        color: "#1F2937",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <img
          src="/screenly-logo.png"
          alt="Screenly"
          style={{ height: 100 }}
        />

        <a href="/login">
          <button
            style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              border: "none",
              padding: "12px 26px",
              borderRadius: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Log in
          </button>
        </a>
      </div>

      {/* HERO */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 80,
          alignItems: "center",
          marginTop: 80,
        }}
      >
        <div>
          <h1 style={{ fontSize: 52, fontWeight: 800 }}>
            Automated screenshots with timestamp.
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "#6B7280",
              marginTop: 20,
              maxWidth: 520,
              lineHeight: 1.6,
            }}
          >
            No manual screenshots. No gaps. No uncertainty.
          </p>

          <div style={{ marginTop: 30 }}>
            <a href="/signup">
              <button
                style={{
                  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                  color: "white",
                  padding: "16px 30px",
                  borderRadius: 14,
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Start Free
              </button>
            </a>
          </div>
        </div>

        <div>
          <img
            src="/dashboard-preview.png"
            style={{
              width: "100%",
              borderRadius: 16,
              boxShadow: "0 30px 70px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ marginTop: 120, textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800 }}>How it works</h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 80,
            marginTop: 50,
          }}
        >
          <div>
            <div style={{ fontSize: 40 }}>🔗</div>
            <h3>Add URL</h3>
            <p style={{ color: "#6B7280" }}>
              Paste your job posting link
            </p>
          </div>

          <div>
            <div style={{ fontSize: 40 }}>⚡</div>
            <h3>We capture it</h3>
            <p style={{ color: "#6B7280" }}>
              Automatic timestamped screenshots
            </p>
          </div>

          <div>
            <div style={{ fontSize: 40 }}>📄</div>
            <h3>Download proof</h3>
            <p style={{ color: "#6B7280" }}>
              Access and download your timestamped PDFs for 62 days
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ marginTop: 140, textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800 }}>Simple pricing</h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 40,
            marginTop: 50,
          }}
        >
          {/* BASIC */}
          <div style={card}>
            <h3>Basic</h3>
            <p style={price}>$15</p>
            <p style={muted}>per month</p>

            <ul style={list}>
              <li>10 URLs</li>
              <li>Scheduled captures</li>
              <li>PDF downloads</li>
            </ul>

            <a href="/signup?plan=basic">
              <button style={btnPrimary}>Choose Basic</button>
            </a>
          </div>

          {/* PRO */}
          <div style={{ ...card, border: "2px solid #6A11CB" }}>
            <h3>Professional</h3>
            <p style={price}>$30</p>
            <p style={muted}>per month</p>

            <ul style={list}>
              <li>20–50 URLs</li>
              <li>Scheduled captures</li>
              <li>PDF downloads</li>
            </ul>

            <a href="/signup?plan=pro">
              <button style={btnGradient}>Choose Professional</button>
            </a>
          </div>

          {/* CUSTOM PLAN */}
          <div style={card}>
            <h3>Custom</h3>
            <p style={price}>Custom</p>
            <p style={muted}>enterprise</p>

            <ul style={list}>
              <li>Unlimited URLs</li>
              <li>Scheduled captures</li>
              <li>PDF downloads</li>
            </ul>

            <p style={{ marginTop: 20, fontWeight: 600 }}>
              Contact:
            </p>
            <p style={{ color: "#6A11CB" }}>
              support@screenly.app
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          marginTop: 120,
          textAlign: "center",
          color: "#9CA3AF",
        }}
      >
        © 2026 Screenly
      </footer>
    </main>
  )
}

/* STYLES */
const card = {
  background: "#fff",
  padding: 40,
  borderRadius: 16,
  width: 280,
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
}

const price = {
  fontSize: 36,
  fontWeight: 800,
}

const muted = {
  color: "#6B7280",
}

const list = {
  listStyle: "none",
  padding: 0,
  marginTop: 20,
  lineHeight: 1.8,
}

const btnPrimary = {
  marginTop: 20,
  background: "#6A11CB",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
}

const btnGradient = {
  marginTop: 20,
  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
  color: "#fff",
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
}
