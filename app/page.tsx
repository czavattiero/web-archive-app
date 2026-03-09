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
          alignItems: "center",
          padding: "25px 60px",
        }}
      >
        <img
          src="/screenly.png"
          alt="Screenly"
          style={{ height: 60 }}
        />

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

      {/* Hero Section */}
      <section
        style={{
          textAlign: "center",
          paddingTop: 100,
          paddingBottom: 40,
        }}
      >
        <h1
          style={{
            fontSize: 40,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          Because you have more important things to do
        </h1>

        <p
          style={{
            maxWidth: 600,
            margin: "0 auto",
            fontSize: 14,
            color: "#666",
            lineHeight: 1.6,
          }}
        >
          Screenly allows you to automate the capture of URLs and schedule
          future captures. Each capture is stored as a PDF that can be
          downloaded anytime from your dashboard.
        </p>
      </section>

      {/* Pricing Section */}
      <section
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 40,
          paddingBottom: 80,
          marginTop: 40,
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
          <h3 style={{ fontSize: 22 }}>Basic</h3>

          <p
            style={{
              fontSize: 34,
              fontWeight: 700,
              margin: "10px 0",
            }}
          >
            $9
          </p>

          <p style={{ color: "#666", marginBottom: 25 }}>per month</p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginBottom: 25,
              color: "#555",
              lineHeight: 1.8,
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
          <h3 style={{ fontSize: 22 }}>Professional</h3>

          <p
            style={{
              fontSize: 34,
              fontWeight: 700,
              margin: "10px 0",
            }}
          >
            $29
          </p>

          <p style={{ color: "#666", marginBottom: 25 }}>per month</p>

          <ul
            style={{
              listStyle: "none",
              padding: 0,
              marginBottom: 25,
              color: "#555",
              lineHeight: 1.8,
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
