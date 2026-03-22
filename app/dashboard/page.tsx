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

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    console.log("🚀 Fetching data...")

    const { data: urlsData, error: urlError } = await supabase
      .from("urls")
      .select("*")

    const { data: capturesData, error: captureError } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    if (urlError) console.error("❌ URL fetch error:", urlError)
    if (captureError) console.error("❌ Capture fetch error:", captureError)

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!url) return

    console.log("➕ Adding URL:", url)

    const { error } = await supabase.from("urls").insert([
      {
        url,
        next_capture_at: new Date().toISOString(),
      },
    ])

    if (error) {
      console.error("❌ Insert URL error:", error)
    } else {
      console.log("✅ URL added")
    }

    setUrl("")
    fetchData()
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Dashboard</h1>

      {/* ADD URL */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL"
          style={{ padding: 8, marginRight: 10, width: 300 }}
        />
        <button onClick={addUrl}>Add URL</button>
      </div>

      {/* URL LIST */}
      <h2>Tracked URLs</h2>
      {urls.length === 0 && <p>No URLs yet</p>}
      {urls.map((u) => (
        <div key={u.id}>{u.url}</div>
      ))}

      {/* CAPTURES */}
      <h2 style={{ marginTop: 30 }}>Captures</h2>

      {captures.length === 0 && <p>No captures found</p>}

      {captures.map((c) => {
        // 🔥 FIXED PUBLIC URL
        const { data } = supabase.storage
          .from("captures")
          .getPublicUrl(c.file_path)

        return (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <p>{c.file_path}</p>

            {c.file_path && (
              <a href={data.publicUrl} target="_blank">
                View PDF
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
