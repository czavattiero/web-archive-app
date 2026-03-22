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

  // 🔐 AUTH
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push("/login")
        return
      }

      setUser(data.user)
      setLoadingUser(false)
      fetchData()
    }

    loadUser()
  }, [])

  // 📡 REALTIME SUBSCRIPTION (🔥 THIS IS THE MAGIC)
  useEffect(() => {
    const channel = supabase
      .channel("captures-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "captures",
        },
        (payload) => {
          console.log("🔥 New capture:", payload)

          // Add new capture instantly
          setCaptures((prev) => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // 📦 FETCH DATA
  async function fetchData() {
    const { data: urlsData } = await supabase.from("urls").select("*")

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  // ➕ ADD URL
  async function addUrl() {
    if (!user || !url) return

    await supabase.from("urls").insert([
      {
        url,
        user_id: user.id,
        next_capture_at: new Date().toISOString(),
        schedule_type: "weekly",
      },
    ])

    // 🔥 trigger worker
    await fetch("/api/run-worker", { method: "POST" })

    setUrl("")
  }

  function getUrlById(id: string) {
    return urls.find((u) => u.id === id)
  }

  if (loadingUser) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>

      {/* ADD URL */}
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
      />
      <button onClick={addUrl}>Add URL</button>

      {/* URLS */}
      <h2>Tracked URLs</h2>
      {urls.map((u) => (
        <div key={u.id}>
          {u.url} — {u.schedule_type} —{" "}
          {new Date(u.created_at).toLocaleString()}
        </div>
      ))}

      {/* CAPTURES */}
      <h2>Capture History</h2>

      {captures.map((c) => {
        if (!c.file_path) return null

        const urlData = getUrlById(c.url_id)

        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

        return (
          <div key={c.id}>
            {urlData?.url} —{" "}
            {new Date(c.created_at).toLocaleString()} —{" "}
            <a href={publicUrl} target="_blank">
              Download
            </a>
          </div>
        )
      })}
    </div>
  )
}
