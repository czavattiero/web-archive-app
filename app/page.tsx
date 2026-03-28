export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #ffffff, #f7f8fb)",
        fontFamily: "system-ui, sans-serif",
        padding: "40px 80px",
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
        <img src="/screenly.png" alt="Screenly" style={{ height: 80 }} />

        <a href="/login">
          <button
            style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
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

      {/* HERO */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 60,
          alignItems: "center",
          marginTop: 60,
        }}
      >
        {/* LEFT */}
        <div>
          <h1 style={{ fontSize: 44, fontWeight: 800, marginBottom: 20 }}>
            Automatically capture and archive any webpage
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "#6B7280",
              lineHeight: 1.6,
              marginBottom: 30,
              maxWidth: 500,
            }}
          >
            Add a URL once. Screenly monitors and saves it as a PDF — so you never lose important content again.
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            <a href="/signup">
              <button
                style={{
                  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                  color: "white",
                  border: "none",
                  padding: "14px 26px",
                  borderRadius: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 10px 20px rgba(106,17,203,0.25)",
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
                  padding: "14px 24px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Log in
              </button>
            </a>
          </div>
        </div>

        {/* RIGHT */}
        <div>
          <img
            src="/dashboard-preview.png"
            alt="Dashboard preview"
            style={{
              width: "100%",
              borderRadius: 14,
              boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
              border: "1px solid #eee",
            }}
          />
        </div>
      </section>

      {/* TRUST STRIP */}
      <section
        style={{
          textAlign: "center",
          marginTop: 80,
          paddingTop: 30,
          borderTop: "1px solid #eee",
        }}
      >
        <p style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10 }}>
          Trusted for monitoring important web content
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 30, color: "#9CA3AF", fontSize: 13 }}>
          <span>Legal Teams</span>
          <span>Researchers</span>
          <span>Compliance</span>
          <span>Startups</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ marginTop: 100, textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 50 }}>
          How it works
        </h2>

        <div style={{ display: "flex", justifyContent: "center", gap: 60 }}>
          <div>
            <div style={{ fontSize: 40 }}>🔗</div>
            <h3>Add URL</h3>
            <p style={{ fontSize: 14, color: "#6B7280" }}>
              Paste any webpage you want to monitor
            </p>
          </div>

          <div>
            <div style={{ fontSize: 40 }}>⚡</div>
            <h3>We capture it</h3>
            <p style={{ fontSize: 14, color: "#6B7280" }}>
              Screenshots saved automatically
            </p>
          </div>

          <div>
            <div style={{ fontSize: 40 }}>📄</div>
            <h3>Download anytime</h3>
            <p style={{ fontSize: 14, color: "#6B7280" }}>
              Access PDFs from dashboard
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        style={{
          background: "#F3F4F6",
          marginTop: 100,
          padding: "60px 40px",
          borderRadius: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 60, textAlign: "center" }}>
          <div>
            <h3>Automated capture</h3>
            <p style={{ fontSize: 14, color: "#6B7280" }}>
              Daily, weekly or custom schedules
            </p>
          </div>

          <div>
            <h3>Secure storage</h3>
            <p style={{ fontSize: 14, color: "#6B7280" }}>
              PDFs stored safely and accessible anytime
            </p>
          </div>

          <div>
            <h3>Scalable</h3>
            <p style={{ fontSize: 14, color: "#6B7280" }}>
              Monitor unlimited URLs with pro plan
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ marginTop: 120, textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 50 }}>
          Simple pricing
        </h2>

        <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
          
          {/* BASIC */}
          <div
            style={{
              background: "white",
              padding: 40,
              borderRadius: 14,
              width: 280,
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Basic</h3>
            <p style={{ fontSize: 36, fontWeight: 800 }}>$15</p>
            <p style={{ color: "#6B7280" }}>per month</p>

            <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
              <li>10 monitored URLs</li>
              <li>Daily captures</li>
              <li>PDF download</li>
            </ul>

            <a href="/signup?plan=basic">
              <button
                style={{
                  marginTop: 20,
                  background: "#6A11CB",
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

          {/* PRO */}
          <div
            style={{
              background: "white",
              padding: 40,
              borderRadius: 14,
              width: 280,
              border: "2px solid #6A11CB",
              boxShadow: "0 15px 40px rgba(106,17,203,0.2)",
              transform: "scale(1.05)",
            }}
          >
            <div
              style={{
                background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                color: "white",
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                display: "inline-block",
                marginBottom: 10,
              }}
            >
              Most Popular
            </div>

            <h3>Professional</h3>
            <p style={{ fontSize: 36, fontWeight: 800 }}>$30</p>
            <p style={{ color: "#6B7280" }}>per month</p>

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
                  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
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

        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          marginTop: 100,
          borderTop: "1px solid #eee",
          paddingTop: 30,
          textAlign: "center",
          fontSize: 13,
          color: "#9CA3AF",
        }}
      >
        <p>© 2026 Screenly</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 10 }}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>

    </main>
  )
}
        }}
      >
        <img src="/screenly.png" alt="Screenly" style={{ height: 80 }} />

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

      {/* HERO */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 60,
          alignItems: "center",
          marginTop: 60,
        }}
      >
        {/* LEFT */}
        <div>
          <h1 style={{ fontSize: 44, fontWeight: 700, marginBottom: 20 }}>
            Automatically capture and archive any webpage
          </h1>

          <p
            style={{
              fontSize: 16,
              color: "#555",
              lineHeight: 1.6,
              marginBottom: 30,
              maxWidth: 500,
            }}
          >
            Add a URL once. Screenly monitors and saves it as a PDF — so you never lose important content again.
          </p>

          <div style={{ display: "flex", gap: 12 }}>
            <a href="/signup">
              <button
                style={{
                  background: "#5B4DFF",
                  color: "white",
                  border: "none",
                  padding: "14px 24px",
                  borderRadius: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Start Free
              </button>
            </a>

            <a href="/login">
              <button
                style={{
                  background: "white",
                  border: "1px solid #ddd",
                  padding: "14px 24px",
                  borderRadius: 10,
                  cursor: "pointer",
                }}
              >
                Log in
              </button>
            </a>
          </div>
        </div>

        {/* RIGHT (PRODUCT PREVIEW) */}
        <div>
          <img
            src="/dashboard-preview.png"
            alt="Dashboard preview"
            style={{
              width: "100%",
              borderRadius: 14,
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              border: "1px solid #eee",
            }}
          />
        </div>
      </section>

      {/* TRUST STRIP */}
      <section
        style={{
          textAlign: "center",
          marginTop: 80,
          paddingTop: 30,
          borderTop: "1px solid #eee",
        }}
      >
        <p style={{ fontSize: 13, color: "#888", marginBottom: 10 }}>
          Trusted for monitoring important web content
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 30, color: "#aaa", fontSize: 13 }}>
          <span>Legal Teams</span>
          <span>Researchers</span>
          <span>Compliance</span>
          <span>Startups</span>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ marginTop: 100, textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 50 }}>
          How it works
        </h2>

        <div style={{ display: "flex", justifyContent: "center", gap: 60 }}>
          <div>
            <div style={{ fontSize: 40 }}>🔗</div>
            <h3>Add URL</h3>
            <p style={{ fontSize: 14, color: "#666" }}>
              Paste any webpage you want to monitor
            </p>
          </div>

          <div>
            <div style={{ fontSize: 40 }}>⚡</div>
            <h3>We capture it</h3>
            <p style={{ fontSize: 14, color: "#666" }}>
              Screenshots saved automatically
            </p>
          </div>

          <div>
            <div style={{ fontSize: 40 }}>📄</div>
            <h3>Download anytime</h3>
            <p style={{ fontSize: 14, color: "#666" }}>
              Access PDFs from dashboard
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        style={{
          background: "#f3f4f8",
          marginTop: 100,
          padding: "60px 40px",
          borderRadius: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 60, textAlign: "center" }}>
          <div>
            <h3>Automated capture</h3>
            <p style={{ fontSize: 14, color: "#666" }}>
              Daily, weekly or custom schedules
            </p>
          </div>

          <div>
            <h3>Secure storage</h3>
            <p style={{ fontSize: 14, color: "#666" }}>
              PDFs stored safely and accessible anytime
            </p>
          </div>

          <div>
            <h3>Scalable</h3>
            <p style={{ fontSize: 14, color: "#666" }}>
              Monitor unlimited URLs with pro plan
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        style={{
          marginTop: 120,
          textAlign: "center",
        }}
      >
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 50 }}>
          Simple pricing
        </h2>

        <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
          
          {/* BASIC */}
          <div
            style={{
              background: "white",
              padding: 40,
              borderRadius: 14,
              width: 280,
              boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
            }}
          >
            <h3>Basic</h3>
            <p style={{ fontSize: 36, fontWeight: 700 }}>$15</p>
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

          {/* PRO */}
          <div
            style={{
              background: "white",
              padding: 40,
              borderRadius: 14,
              width: 280,
              border: "2px solid #5B4DFF",
              boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
              transform: "scale(1.05)",
            }}
          >
            <div
              style={{
                background: "#5B4DFF",
                color: "white",
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 6,
                display: "inline-block",
                marginBottom: 10,
              }}
            >
              Most Popular
            </div>

            <h3>Professional</h3>
            <p style={{ fontSize: 36, fontWeight: 700 }}>$30</p>
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

        </div>
      </section>

      {/* FAQ */}
      <section style={{ marginTop: 100, maxWidth: 700, marginInline: "auto" }}>
        <h2 style={{ textAlign: "center", marginBottom: 30 }}>
          FAQ
        </h2>

        <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6 }}>
          <p><strong>Do you store my data?</strong><br />Yes, securely in your account.</p>
          <br />
          <p><strong>Can I cancel anytime?</strong><br />Yes, no lock-in.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          marginTop: 100,
          borderTop: "1px solid #eee",
          paddingTop: 30,
          textAlign: "center",
          fontSize: 13,
          color: "#888",
        }}
      >
        <p>© 2026 Screenly</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 10 }}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>

    </main>
  )
}
