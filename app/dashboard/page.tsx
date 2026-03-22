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
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getUser()
    fetchData()
  }, [])

  async function getUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data.user)
  }

  async function fetchData() {
    const { data: urlsData } = await supabase.from("urls").select("*")
    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!url || !user) {
      alert("User not loaded yet")
      return
    }

    setLoading(true)

    const { error } = await supabase.from("urls").insert([
      {
        url,
        user_id: user.id, // 🔥 FIX HERE
        next_capture_at: new Date().toISOString(),
        schedule_type: "weekly",
      },
    ])

    if (error) {
      console.error(error)
    }

    setUrl("")
    setLoading(false)
    fetchData()
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>

      <div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <button onClick={addUrl}>
          {loading ? "Adding..." : "Add URL"}
        </button>
      </div>

      <h2>Tracked URLs</h2>
      {urls.map((u) => (
        <div key={u.id}>{u.url}</div>
      ))}

      <h2>Captures</h2>
      {captures.map((c) => (
        <div key={c.id}>{c.file_path || "Failed"}</div>
      ))}
    </div>
  )
}
