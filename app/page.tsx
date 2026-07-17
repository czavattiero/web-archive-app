"use client"

import { useState } from "react"

export default function Home() {
  const [disclaimerExpanded, setDisclaimerExpanded] = useState(false)

  return (
    <main style={{
      minHeight: "100vh",
      background: "#ffffff",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#111827",
    }}>

      {/* NAVIGATION */}
      <nav className="landing-nav" style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: "1px solid #E5E7EB",
        height: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <img src="/Timedshot-logo.png" alt="Timedshot logo" className="logo-pulse" style={{ height: 120 }} />
        <div className="nav-actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
      <section className="hero-section" style={{
        maxWidth: 1200,
        margin: "0 auto",
      }}>
        {/* LEFT */}
        <div>
          <h1 className="hero-heading" style={{
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
      <section className="how-section" style={{
        maxWidth: 1100,
        margin: "0 auto",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6A11CB", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          How it works
        </p>
        <h2 className="section-heading" style={{ fontSize: 36, fontWeight: 800, color: "#111827", margin: 0 }}>
          Three steps to timestamped proof
        </h2>

        <div className="steps-grid" style={{
        }}>
          {[
            {
              number: "01",
              icon: "🔗",
              title: "Add URL",
              desc: "Paste the URL you want to monitor. It's captured immediately — no need to schedule the first one.",
              accent: "#6A11CB",
              accentRgb: "106,17,203",
              details: [] as string[],
            },
            {
              number: "02",
              icon: "⚡",
              title: "Set your schedule",
              desc: "Schedule the next capture:",
              accent: "#FF7A00",
              accentRgb: "255,122,0",
              details: ["Weekly", "Biweekly", "Every 29 days", "Every 30 days", "Specific date"],
            },
            {
              number: "03",
              icon: "📄",
              title: "Get your proof",
              desc: "Your timestamped PDF is emailed to you and available in your account for 60 days.",
              accent: "#10B981",
              accentRgb: "16,185,129",
              details: [] as string[],
            },
          ].map((step) => (
            <div key={step.number} style={{
              background: "#FFFFFF",
              borderRadius: 16,
              padding: "32px 28px",
              border: "1px solid #E5E7EB",
              borderTop: `4px solid ${step.accent}`,
              boxShadow: `0 8px 32px rgba(${step.accentRgb}, 0.15)`,
              position: "relative" as const,
            }}>
              <div style={{
                position: "absolute" as const,
                top: 24,
                right: 24,
                fontSize: 11,
                fontWeight: 700,
                color: step.accent,
                letterSpacing: 1,
              }}>
                {step.number}
              </div>
              <div style={{
                background: `rgba(${step.accentRgb}, 0.08)`,
                borderRadius: "50%",
                width: 56,
                height: 56,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                marginBottom: 16,
              }}>
                {step.icon}
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>
                {step.desc}
              </p>
              {step.details.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "flex", flexDirection: "column" as const, gap: 6 }}>
                  {step.details.map((detail) => (
                    <li key={detail} style={{ display: "flex", gap: 8, fontSize: 13, color: "#374151", alignItems: "center" }}>
                      <span style={{ color: step.accent, fontWeight: 700, flexShrink: 0 }}>·</span> {detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Important information — shown below the Step 1: Add URL card */}
        <div style={{ marginTop: 16, textAlign: "left" }}>
          <button
            onClick={() => setDisclaimerExpanded((v) => !v)}
            aria-expanded={disclaimerExpanded}
            aria-label="Toggle important information disclaimer"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "#9CA3AF",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>ℹ️</span>
            <span style={{ textDecoration: "underline" }}>Important information</span>
            <span style={{ fontSize: 10 }}>{disclaimerExpanded ? "Show less" : "▼"}</span>
          </button>
          {disclaimerExpanded && (
            <div style={{
              marginTop: 12,
              fontSize: 12,
              color: "#6B7280",
              lineHeight: 1.7,
              textAlign: "left",
            }}>
              <p style={{ marginBottom: 8 }}>
                <strong style={{ color: "#374151" }}>
                  Important Notice: URL Capture Limitations —{" "}
                </strong>
                Capture attempts for certain URLs (e.g., job posting platforms) may fail due to
                restrictions enforced by those websites. It is your responsibility to verify that captures
                have completed successfully.
              </p>
              <ul style={{ paddingLeft: 18, margin: "0 0 8px" }}>
                <li style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#374151" }}>Failed captures will not count toward your monthly URL limit.</strong>{" "}
                  If an immediate capture attempt is unsuccessful, that URL will not be deducted from your
                  plan&apos;s monthly allowance (e.g., 15 or 40 URLs).
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#374151" }}>Some platforms are more restrictive than others.</strong>{" "}
                  URLs from job sites such as <strong style={{ color: "#374151" }}>Indeed</strong>,{" "}
                  <strong style={{ color: "#374151" }}>Monster</strong>,{" "}
                  <strong style={{ color: "#374151" }}>Glassdoor</strong>,{" "}
                  <strong style={{ color: "#374151" }}>Workopolis</strong>,{" "}
                  <strong style={{ color: "#374151" }}>Eluta</strong>, and{" "}
                  <strong style={{ color: "#374151" }}>Ziprecruiter</strong> will most likely fail due to
                  blocking mechanisms.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#374151" }}>When a job site provides a &ldquo;copy link&rdquo; option,</strong>{" "}
                  copy the link to the specific job posting.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#374151" }}>Some captures may appear successful but still be incomplete.</strong>{" "}
                  Job sites that do not provide a &ldquo;copy link&rdquo; option and require clicking
                  &ldquo;show more&rdquo; to view hidden posting content (e.g., LinkedIn) may show
                  captures as &ldquo;success&rdquo; even when the full job posting was not captured.
                </li>
                <li style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#374151" }}>The job boards with the highest success rates include:</strong>{" "}
                  canadajobs.com, Job Bank (Government of Canada), SimplyHired Canada, Talent.com Canada,
                  WowJobs, Aboriginal Job Board, New Canadian Jobs, Jobboom (French), University Affairs,
                  Academic Work (CAUT), and most Canadian universities&apos; career sites.
                </li>
              </ul>
              <p style={{ margin: 0 }}>
                We recommend regularly reviewing your capture history to confirm successful captures and
                take any necessary action.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* DEMO */}
      <section className="demo-section" style={{
        background: "#F9FAFB",
        borderTop: "1px solid #E5E7EB",
        borderBottom: "1px solid #E5E7EB",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#6A11CB", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
            See it in action
          </p>
          <h2 className="section-heading" style={{ fontSize: 36, fontWeight: 800, color: "#111827", marginBottom: 12 }}>
            Watch how Timedshot works
          </h2>

          {/* Arcade interactive demo */}
          <div style={{
            position: "relative" as const,
            width: "100%",
            paddingBottom: "calc(56.25% + 41px)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            border: "1px solid #E5E7EB",
          }}>
            <iframe
              src="https://demo.arcade.software/JqUGB4hlwxA2yV2n9nAg?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true"
              title="Timedshot Demo"
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              allow="clipboard-write"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" style={{
        maxWidth: 1100,
        margin: "0 auto",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#6A11CB", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
          Pricing
        </p>
        <h2 className="section-heading" style={{ fontSize: 36, fontWeight: 800, color: "#111827", margin: "0 0 8px" }}>
          Simple pricing
        </h2>
        <p style={{ fontSize: 16, color: "#6B7280", marginBottom: 56 }}>
          Start free. Upgrade when you're ready.
        </p>

        <div className="pricing-grid" style={{
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
              {"Up to 15 URLs every 30 days,Scheduled captures,timestamped PDF downloads".split(',').map(f => (
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
              {"Up to 40 URLs every 30 days,Scheduled captures,timestamped PDF downloads".split(',').map(f => (
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
              {"Unlimited URLs,Scheduled captures,timestamped PDF downloads".split(',').map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151", alignItems: "flex-start" }}>
                  <span style={{ color: "#6A11CB", fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>
            <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: "0 0 4px" }}>Contact us:</p>
              <a href="mailto:support@timedshot.ca" style={{ fontSize: 14, color: "#6A11CB", fontWeight: 600, textDecoration: "none" }}>
                support@timedshot.ca
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="cta-section" style={{
        background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
        textAlign: "center",
      }}>
        <h2 className="section-heading" style={{ fontSize: 36, fontWeight: 800, color: "#fff", margin: "0 0 16px" }}>
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
      <footer className="landing-footer" style={{
        background: "#111827",
      }}>
        <img src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 56, filter: "brightness(0) invert(1)", opacity: 0.7 }} />
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>© 2026 Timedshot. All rights reserved.</p>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="/login" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Log in</a>
          <a href="mailto:support@timedshot.ca" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Contact</a>
          <a href="/terms" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>Terms of Use</a>
        </div>
      </footer>

    </main>
  )
}
