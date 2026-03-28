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
        {/* ✅ BIGGER LOGO */}
        <img
          src="/screenly.png"
          alt="Screenly"
          style={{
            height: 75,
            width: "auto",
          }}
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
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 10px 25px rgba(106,17,203,0.25)",
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
        {/* LEFT */}
        <div>
          <h1 style={{ fontSize: 56, fontWeight: 800, marginBottom: 24 }}>
            Automatically capture and archive any webpage
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "#6B7280",
              lineHeight: 1.7,
              marginBottom: 35,
              maxWidth: 550,
            }}
          >
            Add a URL once. Screenly monitors and saves it as a PDF — so you never lose important content again.
          </p>

          <div style={{ display: "flex", gap: 16 }}>
            <a href="/signup">
              <button
                style={{
                  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                  color: "white",
                  border: "none",
                  padding: "16px 30px",
                  borderRadius: 14,
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 15px 30px rgba(106,17,203,0.25)",
                }}
              >
                Start Free
              </button>
            </a>

            <a href="/login">
              <button
                style={{
                  background: "white",
                  border: "1px solid #E5E7EB",
                  padding: "16px 26px",
                  borderRadius: 14,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                Log in
              </button>
            </a>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <img
            src="/dashboard-preview.png"
            alt="Dashboard preview"
            style={{
              width: "100%",
              maxWidth: 550,
              borderRadius: 18,
              boxShadow: "0 30px 70px rgba(0,0,0,0.2)",
              border: "1px solid #eee",
            }}
          />
        </div>
      </section>

      {/* TRUST */}
      <section
        style={{
          textAlign: "center",
          marginTop: 100,
          paddingTop: 40,
          borderTop: "1px solid #eee",
        }}
      >
        <p style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 12 }}>
          Trusted for monitoring important web content
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 40, color: "#9CA3AF", fontSize: 14 }}>
          <span>Legal Teams</span>
          <span>Researchers</span>
          <span>Compliance</span>
          <span>Startups</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ marginTop: 120, textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 60 }}>
          How it works
        </h2>

        <div style={{ display: "flex", justifyContent: "center", gap: 80 }}>
          <div>
            <div style={{ fontSize: 48 }}>🔗</div>
            <h3 style={{ fontSize: 18 }}>Add URL</h3>
            <p style={{ fontSize: 15, color: "#6B7280" }}>
              Paste any webpage you want to monitor
            </p>
          </div>

          <div>
            <div style={{ fontSize: 48 }}>⚡</div>
            <h3 style={{ fontSize: 18 }}>We capture it</h3>
            <p style={{ fontSize: 15, color: "#6B7280" }}>
              Screenshots saved automatically
            </p>
          </div>

          <div>
            <div style={{ fontSize: 48 }}>📄</div>
            <h3 style={{ fontSize: 18 }}>Download anytime</h3>
            <p style={{ fontSize: 15, color: "#6B7280" }}>
              Access PDFs from dashboard
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        style={{
          background: "#F3F4F6",
          marginTop: 120,
          padding: "70px 40px",
          borderRadius: 24,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 80, textAlign: "center" }}>
          <div>
            <h3 style={{ fontSize: 18 }}>Automated capture</h3>
            <p style={{ fontSize: 15, color: "#6B7280" }}>
              Daily, weekly or custom schedules
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 18 }}>Secure storage</h3>
            <p style={{ fontSize: 15, color: "#6B7280" }}>
              PDFs stored safely and accessible anytime
            </p>
          </div>

          <div>
            <h3 style={{ fontSize: 18 }}>Scalable</h3>
            <p style={{ fontSize: 15, color: "#6B7280" }}>
              Monitor unlimited URLs with pro plan
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ marginTop: 140, textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 60 }}>
          Simple pricing
        </h2>

        <div style={{ display: "flex", justifyContent: "center", gap: 50 }}>
          
          {/* BASIC */}
          <div style={{
            background: "white",
            padding: 50,
            borderRadius: 18,
            width: 300,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}>
            <h3>Basic</h3>
            <p style={{ fontSize: 40, fontWeight: 800 }}>$15</p>
            <p style={{ color: "#6B7280" }}>per month</p>

            <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
              <li>10 monitored URLs</li>
              <li>Daily captures</li>
              <li>PDF download</li>
            </ul>

            <a href="/signup?plan=basic">
              <button style={{
                marginTop: 25,
                background: "#6A11CB",
                color: "white",
                padding: "14px 24px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
              }}>
                Choose Basic
              </button>
            </a>
          </div>

          {/* PRO */}
          <div style={{
            background: "white",
            padding: 50,
            borderRadius: 18,
            width: 300,
            border: "2px solid #6A11CB",
            transform: "scale(1.06)",
            boxShadow: "0 20px 50px rgba(106,17,203,0.2)",
          }}>
            <div style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "white",
              padding: "5px 12px",
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 10,
              display: "inline-block"
            }}>
              Most Popular
            </div>

            <h3>Professional</h3>
            <p style={{ fontSize: 40, fontWeight: 800 }}>$30</p>
            <p style={{ color: "#6B7280" }}>per month</p>

            <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
              <li>Unlimited URLs</li>
              <li>Hourly captures</li>
              <li>Priority processing</li>
              <li>PDF archive</li>
            </ul>

            <a href="/signup?plan=pro">
              <button style={{
                marginTop: 25,
                background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                color: "white",
                padding: "14px 24px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
              }}>
                Choose Professional
              </button>
            </a>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        marginTop: 120,
        borderTop: "1px solid #eee",
        paddingTop: 40,
        textAlign: "center",
        fontSize: 14,
        color: "#9CA3AF",
      }}>
        <p>© 2026 Screenly</p>
      </footer>

    </main>
  )
}
