"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [url, setUrl] = useState("")
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: urlsData } = await supabase.from("urls").select("*")

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
    setLoading(false)
  }

  async function addUrl() {
    if (!url) return

    setLoading(true)

    await supabase.from("urls").insert([
      {
        url,
        next_capture_at: new Date().toISOString(),
      },
    ])

    setUrl("")
    await fetchData()
  }

  return (
    <div style={layout}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <h2 style={logo}>WebArchive</h2>

        <div style={menuItemActive}>Dashboard</div>
        <div style={menuItem}>URLs</div>
        <div style={menuItem}>Captures</div>
        <div style={menuItem}>Settings</div>
      </div>

      {/* MAIN CONTENT */}
      <div style={main}>
        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={card}>
          <h3 style={cardTitle}>Add URL</h3>

          <div style={row}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={input}
            />
            <button onClick={addUrl} style={primaryButton}>
              {loading ? "Adding..." : "Add URL"}
            </button>
          </div>
        </div>

        {/* URL TABLE */}
        <div style={card}>
          <h3 style={cardTitle}>Tracked URLs</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {urls.length === 0 ? (
                <tr>
                  <td colSpan={2} style={empty}>
                    No URLs yet
                  </td>
                </tr>
              ) : (
                urls.map((u) => (
                  <tr key={u.id}>
                    <td style={td}>{u.url}</td>
                    <td style={td}>
                      <span style={badgeActive}>Active</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CAPTURES TABLE */}
        <div style={card}>
          <h3 style={cardTitle}>Captures</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>File</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {captures.length === 0 ? (
                <tr>
                  <td colSpan={3} style={empty}>
                    No captures yet
                  </td>
                </tr>
              ) : (
                captures.map((c) => {
                  const filePath = c.file_path

                  if (!filePath) {
                    return (
                      <tr key={c.id}>
                        <td style={td}>—</td>
                        <td style={td}>
                          <span style={badgeError}>Failed</span>
                        </td>
                        <td style={tdSmall}>{c.error}</td>
                      </tr>
                    )
                  }

                  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${filePath}`

                  return (
                    <tr key={c.id}>
                      <td style={td}>{filePath}</td>
                      <td style={td}>
                        <span style={badgeSuccess}>Success</span>
                      </td>
                      <td style={td}>
                        <a href={publicUrl} target="_blank" style={link}>
                          View
                        </a>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* 🎨 STRIPE-STYLE UI */

const layout = {
  display: "flex",
  fontFamily: "Inter, sans-serif",
  background: "#f6f9fc",
  minHeight: "100vh",
}

const sidebar = {
  width: "220px",
  background: "#0a2540",
  color: "#fff",
  padding: "20px",
}

const logo = {
  marginBottom: "30px",
}

const menuItem = {
  padding: "10px 0",
  opacity: 0.7,
  cursor: "pointer",
}

const menuItemActive = {
  padding: "10px 0",
  fontWeight: "bold",
}

const main = {
  flex: 1,
  padding: "30px",
}

const title = {
  fontSize: "24px",
  marginBottom: "20px",
}

const card = {
  background: "#fff",
  borderRadius: "10px",
  padding: "20px",
  marginBottom: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
}

const cardTitle = {
  marginBottom: "10px",
}

const row = {
  display: "flex",
  gap: "10px",
}

const input = {
  flex: 1,
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd",
}

const primaryButton = {
  background: "#635bff",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: "6px",
  cursor: "pointer",
}

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
}

const th = {
  textAlign: "left" as const,
  padding: "10px",
  fontSize: "12px",
  color: "#8898aa",
}

const td = {
  padding: "10px",
  borderTop: "1px solid #eee",
}

const tdSmall = {
  padding: "10px",
  borderTop: "1px solid #eee",
  fontSize: "12px",
  color: "#999",
}

const empty = {
  padding: "20px",
  textAlign: "center" as const,
  color: "#999",
}

const badgeSuccess = {
  background: "#e6fffa",
  color: "#065f46",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
}

const badgeError = {
  background: "#fff1f0",
  color: "#991b1b",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
}

const badgeActive = {
  background: "#eef2ff",
  color: "#3730a3",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "12px",
}

const link = {
  color: "#635bff",
  textDecoration: "none",
}
