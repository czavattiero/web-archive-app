"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

// ✅ SAFE ENV HANDLING
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

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

    const { error } = await supabase.from("urls").insert([
      {
        url,
        next_capture_at: new Date().toISOString(),
      },
    ])

    if (error) {
      console.error("❌ Insert error:", error)
    }

    setUrl("")
    await fetchData()
  }

  return (
    <div style={container}>
      <h1 style={title}>📊 Dashboard</h1>

      {/* ADD URL */}
      <div style={card}>
        <h2>Add URL</h2>

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
        <h2>Tracked URLs</h2>

        {urls.length === 0 ? (
          <p style={muted}>No URLs yet</p>
        ) : (
          urls.map((u) => (
            <div key={u.id} style={listItem}>
              🔗 {u.url}
            </div>
          ))
        )}
      </div>

      {/* CAPTURES */}
      <div style={card}>
        <h2>Captures</h2>

        {captures.length === 0 ? (
          <p style={muted}>No captures yet</p>
        ) : (
          captures.map((c) => {
            try {
              const filePath = c.file_path

              // ❌ FAILED CAPTURE
              if (
                !filePath ||
                typeof filePath !== "string" ||
                filePath.trim() === ""
              ) {
                return (
                  <div key={c.id} style={errorBox}>
                    ❌ <strong>Capture failed</strong>
                    <div style={errorText}>
                      {c.error || "Unknown error"}
                    </div>
                  </div>
                )
              }

              // ✅ SUCCESS
              const publicUrl = `${supabaseUrl}/storage/v1/object/public/captures/${filePath}`

              return (
                <div key={c.id} style={successBox}>
                  <div>📄 {filePath}</div>

                  <a href={publicUrl} target="_blank" style={link}>
                    View PDF →
                  </a>
                </div>
              )
            } catch (err) {
              console.error("Render error:", err)
              return <div key={Math.random()}>Error rendering</div>
            }
          })
        )}
      </div>
    </div>
  )
}

// 🎨 STYLES

const container = {
  padding: "40px",
  fontFamily: "Arial, sans-serif",
  background: "#f5f7fa",
  minHeight: "100vh",
}

const title = {
  fontSize: "28px",
  marginBottom: "20px",
}

const card = {
  background: "#ffffff",
  padding: "20px",
  borderRadius: "10px",
  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  marginBottom: "20px",
}

const row = {
  display: "flex",
  gap: "10px",
  marginTop: "10px",
}

const input = {
  flex: 1,
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd",
}

const button = {
  padding: "10px 16px",
  borderRadius: "6px",
  border: "none",
  background: "#0070f3",
  color: "#fff",
  cursor: "pointer",
}

const listItem = {
  padding: "8px 0",
  borderBottom: "1px solid #eee",
}

const muted = {
  opacity: 0.6,
}

const successBox = {
  background: "#f6ffed",
  padding: "12px",
  borderRadius: "8px",
  marginBottom: "10px",
  border: "1px solid #b7eb8f",
}

const errorBox = {
  background: "#fff1f0",
  padding: "12px",
  borderRadius: "8px",
  marginBottom: "10px",
  border: "1px solid #ffa39e",
}

const errorText = {
  fontSize: "12px",
  marginTop: "5px",
}

const link = {
  display: "inline-block",
  marginTop: "6px",
  color: "#0070f3",
}
