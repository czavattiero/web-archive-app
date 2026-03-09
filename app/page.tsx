export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8f9fb",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "40px 60px",
        }}
      >
        {/* Logo + tagline */}
        <div>
          <img
            src="/screenly.png"
            alt="Screenly"
            style={{ height: 120 }}
          />

          <p
            style={{
              marginTop: 10,
              fontSize: 16,
              color: "#444",
            }}
          >
            Because you have more important things to do
          </p>
        </div>

        {/* Login button */}
        <a href="/login">
          <button
            style={{
              background: "#5B4DFF",
              color: "white",
              border: "none",
              padding: "10px 18px",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Log in
          </button>
        </a>
      </header>

      {/* Description */}
      <section
        style={{
          maxWidth: 650,
          marginLeft: 60,
          marginTop: 20,
          color: "#666",
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
        Screenly allows you to automate the capture of URLs and schedule
        future captures. Each capture is stored as a PDF that can be
        downloaded anytime from your dashboard.
      </section>

      {/* Pricing */}
      <section
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 40,
          marginTop: 80,
        }}
      >
        {/* Basic */}
        <div
          style={{
            background: "white",
            padding: 40,
            borderRadius: 14,
            width: 280,
            boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}
        >
          <h3>Basic</h3>

          <p style={{ fontSize: 34, fontWeight: 700 }}>$9</p>

          <p style={{ color: "#666" }}>per month</p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginTop: 20,
              marginBottom: 25,
              color: "#555",
            }}
          >
            <li>10 monitored URLs</li>
            <li>Daily captures</li>
            <li>PDF download</li>
          </ul>

          <a href="/api/checkout?plan=basic">
            <button
              style={{
                background: "#5B4DFF",
                color: "white",
                border: "none",
                padding: "12px 22px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Choose Basic
            </button>
          </a>
        </div>

        {/* Professional */}
        <div
          style={{
            background: "white",
            padding: 40,
            borderRadius: 14,
            width: 280,
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            textAlign: "center",
            border: "2px solid #5B4DFF",
          }}
        >
          <h3>Professional</h3>

          <p style={{ fontSize: 34, fontWeight: 700 }}>$29</p>

          <p style={{ color: "#666" }}>per month</p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginTop: 20,
              marginBottom: 25,
              color: "#555",
            }}
          >
            <li>Unlimited URLs</li>
            <li>Hourly captures</li>
            <li>Priority processing</li>
            <li>PDF archive</li>
          </ul>

          <a href="/api/checkout?plan=pro">
            <button
              style={{
                background: "#5B4DFF",
                color: "white",
                border: "none",
                padding: "12px 22px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Choose Professional
            </button>
          </a>
        </div>
      </section>
    </main>
  )
}
