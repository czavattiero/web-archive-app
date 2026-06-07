import fs from "fs"
import path from "path"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Use – Timedshot",
}

export const dynamic = "force-dynamic"

export default function TermsPage() {
  const termsPath = path.join(process.cwd(), "content", "terms.md")
  let content = ""

  try {
    content = fs.readFileSync(termsPath, "utf8")
  } catch {
    content = "Terms of Use are currently unavailable."
  }

  return (
    <main
      style={{
        background: "#ffffff",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#111827",
        minHeight: "100vh",
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px" }}>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginBottom: 24,
            color: "#6A11CB",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          ← Back to home
        </a>

        <article>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontFamily: "'Inter', system-ui, sans-serif",
              lineHeight: 1.7,
              fontSize: 15,
              color: "#111827",
            }}
          >
            {content}
          </pre>
        </article>
      </div>
    </main>
  )
}
