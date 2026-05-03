"use client"

export default function Home() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#ffffff",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#111827",
    }}>

      {/* NAVIGATION */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: "1px solid #E5E7EB",
        padding: "0 80px",
        height: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 72 }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/login" style={{ fontSize: 14, fontWeight: 500, color: "#374151", textDecoration: "none" }}>
            Log in
          </a>
          <a href="/signup?plan=trial">
            <button style={{
              background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
              color: "#fff",
              border: "none",
              padding: "9px 20px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}>
              Start Free
            </button>
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 60,
        alignItems: "center",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "100px 80px",
      }}>
        {/* LEFT */}
        <div>
          <h1 style={{
            fontSize: 52,
            fontWeight: 800,
            lineHeight: 1.15,
            color: "#111827",
            margin: 0,
          }}>
            Automated screenshots<br />with timestamp.
          </h1>

          <p style={{
            fontSize: 18,
            color: "#6B7280",
            marginTop: 20,
            lineHeight: 1.7,
            maxWidth: 480,
          }}>
            No manual screenshots. No gaps. No uncertainty.
          </p>

          <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/signup?plan=trial">
              <button style={{
                background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                color: "#fff",
                padding: "14px 32px",
                borderRadius: 10,
                border: "none",
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}>
                Start Free
              </button>
            </a>
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              15-day free trial · No credit card required
            </span>
          </div>
        </div>

        {/* RIGHT — dashboard screenshot */}
        <div style={{
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(106,17,203,0.15)",
          border: "1px solid #E5E7EB",
        }}>
          <img
            src="/dashboard-preview.png"
            alt="Timedshot dashboard"
            style={{ width: "100%", display: "block" }}
          />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "100px 80px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6A11CB", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          How it works
        </p>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#111827", margin: 0 }}>
          Three steps to timestamped proof
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 32,
          marginTop: 56,
          textAlign: "left",
        }}>
          {[
            {
              number: "01",
              icon: "🔗",
              title: "Add URL",
              desc: "Paste your URL",
            },
            {
              number: "02",
              icon: "⚡",
              title: "We capture it",
              desc: "Automatic timestamped screenshots",
            },
            {
              number: "03",
              icon: "📄",
              title: "Download proof",
              desc: "Timestamped PDFs available for 62 days",
            },
          ].map((step) => (
            <div key={step.number} style={{
              background: "#F9FAFB",
              borderRadius: 16,
              padding: "32px 28px",
              border: "1px solid #E5E7EB",
              position: "relative" as const,
            }}>
              <div style={{
                position: "absolute" as const,
                top: 24,
                right: 24,
                fontSize: 11,
                fontWeight: 700,
                color: "#C4B5FD",
                letterSpacing: 1,
              }}>
                {step.number}
              </div>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{step.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* DEMO VIDEO */}
      <section style={{
        background: "#F9FAFB",
        borderTop: "1px solid #E5E7EB",
        borderBottom: "1px solid #E5E7EB",
        padding: "100px 80px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#6A11CB", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            See it in action
          </p>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: "#111827", marginBottom: 12 }}>
            Watch how Timedshot works
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", marginBottom: 48, lineHeight: 1.6 }}>
            From adding a URL to downloading your timestamped PDF — in under 2 minutes.
          </p>

          {/* Video embed container */}
          <div style={{
            position: "relative" as const,
            width: "100%",
            paddingBottom: "56.25%",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            border: "1px solid #E5E7EB",
            background: "#111827",
          }}>
            {/*
              TO ADD YOUR VIDEO:
              Replace the div below with:
              <iframe
                src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%, border: "none" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />

              Or for a self-hosted mp4:
              <video
                src="/demo-video.mp4"
                controls
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
              />
            */}
            <div style={{
              position: "absolute" as const,
              inset: 0,
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              gap: 16,
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
              }}>
                ▶
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                Demo video coming soon
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "100px 80px",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6A11CB", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          Pricing
        </p>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>
          Simple pricing
        </h2>
        <p style={{ fontSize: 16, color: "#6B7280", marginBottom: 56 }}>
          Start free. Upgrade when you're ready.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
          alignItems: "start",
        }}>
          {/* BASIC */}
          <div style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 20,
            padding: "36px 32px",
            textAlign: "left",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Basic</h3>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 24px" }}>For individuals getting started</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: "#111827" }}>$12</span>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 28px" }}>CAD / month</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {"Up to 15 URLs every 30 days".split(',').map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151", alignItems: "flex-start" }}>
                  <span style={{ color: "#6A11CB", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="/signup?plan=basic" style={{ display: "block" }}>
              <button style={{
                width: "100%",
                background: "#F3F4F6",
                color: "#111827",
                border: "1px solid #E5E7EB",
                padding: "12px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}>
                Choose Basic
              </button>
            </a>
          </div>

          {/* PROFESSIONAL — highlighted */}
          <div style={{
            background: "linear-gradient(145deg, #6A11CB, #8B5CF6)",
            border: "none",
            borderRadius: 20,
            padding: "36px 32px",
            textAlign: "left",
            boxShadow: "0 12px 40px rgba(106,17,203,0.35)",
            color: "#fff",
            position: "relative" as const,
          }}>
            <div style={{
              position: "absolute" as const,
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(135deg, #FF7A00, #FF9A3C)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 16px",
              borderRadius: 999,
              whiteSpace: "nowrap" as const,
            }}>
              Most Popular
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Professional</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 24px" }}>For power users and teams</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: "#fff" }}>$25</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", margin: "0 0 28px" }}>CAD / month</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {"Up to 40 URLs every 30 days".split(',').map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.9)", alignItems: "flex-start" }}>
                  <span style={{ color: "#FCD34D", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <a href="/signup?plan=pro" style={{ display: "block" }}>
              <button style={{
                width: "100%",
                background: "#fff",
                color: "#6A11CB",
                border: "none",
                padding: "12px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}>
                Choose Professional
              </button>
            </a>
          </div>

          {/* ENTERPRISE */}
          <div style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 20,
            padding: "36px 32px",
            textAlign: "left",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Enterprise</h3>
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 24px" }}>For large teams and organizations</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: "#111827" }}>Custom</span>
            </div>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 28px" }}>custom pricing</p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {"Unlimited URLs,Scheduled captures,PDF downloads".split(',').map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151", alignItems: "flex-start" }}>
                  <span style={{ color: "#6A11CB", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>Contact us:</p>
              <a href="mailto:support@screenly.ca" style={{ fontSize: 14, color: "#6A11CB", fontWeight: 600, textDecoration: "none" }}>
                support@screenly.ca
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{
        background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
        padding: "80px",
        textAlign: "center",
      }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 16px" }}>
          Ready to capture your first screenshot?
        </h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", margin: "0 0 36px" }}>
          15-day free trial · No credit card required
        </p>
        <a href="/signup?plan=trial">
          <button style={{
            background: "#fff",
            color: "#6A11CB",
            border: "none",
            padding: "14px 36px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
            cursor: "pointer",
          }}>
            Start Free
          </button>
        </a>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: "#111827",
        padding: "40px 80px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 56, filter: "brightness(0) invert(1)", opacity: 0.7 }} />
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>© 2026 Timedshot. All rights reserved.</p>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="/login" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Log in</a>
          <a href="mailto:support@screenly.ca" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Contact</a>
        </div>
      </footer>

    </main>
  )
}
