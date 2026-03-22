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

    const { data: urlsData } = await supabase.from("urls").select("*")

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!url) return

    await supabase.from("urls").insert([
      {
        url,
        next_capture_at: new Date().toISOString(),
      },
    ])

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
        try {
          if (!c || typeof c !== "object") {
            return <div key={Math.random()}>Invalid capture</div>
          }

          const filePath = c.file_path

          if (
            !filePath ||
            typeof filePath !== "string" ||
            filePath.trim() === ""
          ) {
            return (
              <div key={c.id || Math.random()}>
                <p>❌ Capture failed</p>
                <p>{c.error || "No file path available"}</p>
              </div>
            )
          }

          const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${filePath}`

          return (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <p>{filePath}</p>
              <a href={publicUrl} target="_blank">
                View PDF
              </a>
            </div>
          )
        } catch (err) {
          console.error("💥 Render crash:", err)
          return <div key={Math.random()}>Error rendering capture</div>
        }
      })}
    </div>
  )
}
