"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [url, setUrl] = useState("")
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])

  // ✅ WAIT FOR USER FIRST
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push("/login")
        return
      }

      setUser(data.user)
      setLoadingUser(false)

      // 🔥 ONLY FETCH AFTER USER EXISTS
      fetchData()
    }

    loadUser()
  }, [])

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
    if (!user) {
      alert("User not ready yet")
      return
    }

    console.log("🔥 Using user_id:", user.id)

    const { error } = await supabase.from("urls").insert([
      {
        url,
        user_id: user.id, // ✅ GUARANTEED NOW
        next_capture_at: new Date().toISOString(),
        schedule_type: "weekly",
      },
    ])

    if (error) {
      console.error("❌ Insert error:", error)
      return
    }

    setUrl("")
    fetchData()
  }

  // 🔒 BLOCK UI UNTIL USER READY
  if (loadingUser) {
    return <div style={{ padding: 40 }}>Loading user...</div>
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

        <button onClick={addUrl}>Add URL</button>
      </div>

      <h2>Tracked URLs</h2>
      {urls.map((u) => (
        <div key={u.id}>
          {u.url} — {u.user_id}
        </div>
      ))}

      <h2>Captures</h2>
      {captures.map((c) => (
        <div key={c.id}>{c.file_path || "Failed"}</div>
      ))}
    </div>
  )
}
