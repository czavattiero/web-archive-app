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
  const [selectedUrlId, setSelectedUrlId] = useState<string | null>(null)
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

  // 🔥 FILTER CAPTURES
  const filteredCaptures = selectedUrlId
    ? captures.filter((c) => c.url_id === selectedUrlId)
    : captures

  return (
    <div style={layout}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <h2 style={logo}>WebArchive</h2>
        <div style={menuItemActive}>Dashboard</div>
        <div style={menuItem}>URLs</div>
        <div style={menuItem}>Captures</div>
      </div>

      {/* MAIN */}
      <div style={main}>
        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={card}>
          <h3>Add URL</h3>
          <div style={row}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={input}
            />
            <button onClick={addUrl} style={button}>
              {loading ? "Adding..." : "Add URL"}
            </button>
          </div>
        </div>

        {/* URL LIST */}
        <div style={card}>
          <h3>Tracked URLs</h3>

          {urls.length === 0 ? (
            <p style={muted}>No URLs yet</p>
          ) : (
            urls.map((u) => (
              <div
                key={u.id}
                onClick={() => setSelectedUrlId(u.id)}
                style={{
                  ...urlItem,
                  ...(selectedUrlId === u.id ? urlItemActive : {}),
                }}
              >
                🔗 {u.url}
              </div>
            ))
          )}
        </div>

        {/* CAPTURE HISTORY */}
        <div style={card}>
          <h3>
            Capture History{" "}
            {selectedUrlId && (
              <span style={mutedSmall}>
                (Filtered by selected URL)
              </span>
            )}
          </h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>File</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredCaptures.length === 0 ? (
                <tr>
                  <td colSpan={3} style={empty}>
                    No captures found
                  </td>
                </tr>
              ) : (
                filteredCaptures.map((c) => {
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

          {/* CLEAR FILTER */}
          {selectedUrlId && (
            <button
              onClick={() => setSelectedUrlId(null)}
              style={clearButton}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* 🎨 STYLES */

const layout = {
  display: "flex",
  background: "#f6f9fc",
  minHeight: "100vh",
  fontFamily: "Inter, sans-serif",
}

const sidebar = {
  width: "220px",
  background: "#0a2540",
  color: "#fff",
  padding: "20px",
}

const logo = { marginBottom: "30px" }

const menuItem = { padding: "10px 0", opacity: 0.7 }
const menuItemActive = { padding: "10px 0", fontWeight: "bold" }

const main = { flex: 1, padding: "30px" }
const title = { fontSize: "24px", marginBottom: "20px" }

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
  marginBottom: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
}

const row = { display: "flex", gap: "10px" }

const input = {
  flex: 1,
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd",
}

const button = {
  background: "#635bff",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: "6px",
  border: "none",
}

const urlItem = {
  padding: "8px",
  cursor: "pointer",
  borderRadius: "6px",
}

const urlItemActive = {
  background: "#eef2ff",
}

const muted = { color: "#999" }
const mutedSmall = { color: "#999", fontSize: "12px" }

const table = { width: "100%", borderCollapse: "collapse" as const }
const th = { textAlign: "left" as const, padding: "10px", fontSize: "12px" }
const td = { padding: "10px", borderTop: "1px solid #eee" }
const tdSmall = { padding: "10px", fontSize: "12px", color: "#999" }

const empty = { padding: "20px", textAlign: "center" as const }

const badgeSuccess = {
  background: "#e6fffa",
  padding: "4px 8px",
  borderRadius: "6px",
}

const badgeError = {
  background: "#fff1f0",
  padding: "4px 8px",
  borderRadius: "6px",
}

const link = { color: "#635bff" }

const clearButton = {
  marginTop: "10px",
  background: "#eee",
  padding: "8px",
  borderRadius: "6px",
}
