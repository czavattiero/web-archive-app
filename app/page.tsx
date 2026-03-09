export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f8fb",
        fontFamily: "system-ui, sans-serif",
        padding: "40px 80px",
      }}
    >

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>

          <img
            src="/screenly.png"
            alt="Screenly"
            style={{ height: 140 }}
          />

          <h2
            style={{
              marginTop: 10,
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            Because you have more important things to do
          </h2>

          <p
            style={{
              marginTop: 10,
              maxWidth: 600,
              fontSize: 14,
              color: "#666",
              lineHeight: 1.6,
            }}
          >
            Screenly allows you to automate the capture of URLs and schedule
            future captures. Each capture is stored as a PDF that can be
            downloaded anytime from your dashboard.
          </p>
        </div>

        <a href="/login">
          <button
            style={{
              background: "#5B4DFF",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Log in
          </button>
        </a>
      </div>

      {/* Pricing */}
      <section
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 40,
          marginTop: 120,
        }}
      >

        {/* BASIC PLAN */}
        <div
          style={{
            background: "white",
            padding: 40,
            borderRadius: 14,
            width: 280,
            textAlign: "center",
            boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
          }}
        >
          <h3>Basic</h3>

          <p style={{ fontSize: 34, fontWeight: 700 }}>$15</p>

          <p style={{ color: "#777" }}>per month</p>

          <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
            <li>10 monitored URLs</li>
            <li>Daily captures</li>
            <li>PDF download</li>
          </ul>

          <a href="/signup?plan=basic">
            <button
              style={{
                marginTop: 20,
                background: "#5B4DFF",
                color: "white",
                border: "none",
                padding: "12px 22px",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Choose Basic
            </button>
          </a>

        </div>

        {/* PROFESSIONAL PLAN */}
        <div
          style={{
            background: "white",
            padding: 40,
            borderRadius: 14,
            width: 280,
            textAlign: "center",
            border: "2px solid #5B4DFF",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          }}
        >
          <h3>Professional</h3>

          <p style={{ fontSize: 34, fontWeight: 700 }}>$30</p>

          <p style={{ color: "#777" }}>per month</p>

          <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
            <li>Unlimited URLs</li>
            <li>Hourly captures</li>
            <li>Priority processing</li>
            <li>PDF archive</li>
          </ul>

          <a href="/signup?plan=pro">
            <button
              style={{
                marginTop: 20,
                background: "#5B4DFF",
                color: "white",
                border: "none",
                padding: "12px 22px",
                borderRadius: 8,
                cursor: "pointer",
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
