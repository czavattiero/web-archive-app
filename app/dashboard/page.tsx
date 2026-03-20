"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {

  const [user, setUser] = useState<any>(null)
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [schedule, setSchedule] = useState("weekly")

  // ✅ FETCH URLS
  async function fetchUrls(userId: string) {
    const { data, error } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (!error && data) {
      setUrls([...data])
    }
  }

  // ✅ FETCH CAPTURES (FIXED)
  async function fetchCaptures(userId: string) {

  // ✅ STEP 1 — Get user's URLs
  const { data: userUrls, error: urlError } = await supabase
    .from("urls")
    .select("id, url")
    .eq("user_id", userId)

  if (urlError || !userUrls) {
    console.error("❌ URL fetch error:", urlError)
    return
  }

  const urlMap = new Map(
    userUrls.map((u: any) => [u.id, u.url])
  )

  const urlIds = userUrls.map((u: any) => u.id)

  if (urlIds.length === 0) {
    setCaptures([])
    return
  }

  // ✅ STEP 2 — Get captures
  const { data: capturesData, error: capError } = await supabase
    .from("captures")
    .select("*")
    .in("url_id", urlIds)
    .order("created_at", { ascending: false })

  if (capError || !capturesData) {
    console.error("❌ Capture fetch error:", capError)
    return
  }

  // ✅ STEP 3 — Attach URL manually
  const formatted = capturesData.map((c: any) => ({
    ...c,
    url: urlMap.get(c.url_id)
  }))

  // 🔥 FORCE UI UPDATE
  setCaptures([...formatted])
}

  // ✅ ADD URL (INSTANT TRIGGER)
  async function addUrl() {

    if (!newUrl || !user) return

    console.log("🚀 Adding URL:", newUrl)

    const { error } = await supabase
      .from("urls")
      .insert({
        url: newUrl,
        user_id: user.id,
        schedule_type: schedule,
        next_capture_at: new Date(Date.now() - 60000).toISOString()
      })

    if (error) {
      console.error("❌ Insert failed:", error)
      return
    }

    setNewUrl("")
    await fetchUrls(user.id)

    // ⚡ TRIGGER WORKER IMMEDIATELY
    try {
      await fetch("/api/capture", { method: "POST" })
      console.log("⚡ Worker triggered")
    } catch (err) {
      console.error("Trigger failed:", err)
    }

    // 🔥 FAST UI UPDATE LOOP (important)
    for (let i = 0; i < 5; i++) {
      await new Promise(res => setTimeout(res, 2000))
      await fetchCaptures(user.id)
    }
  }

  // ✅ SIGN OUT
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  // ✅ INITIAL LOAD + LIVE POLLING
  useEffect(() => {

    let interval: any

    const init = async () => {

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setUser(user)

      await fetchUrls(user.id)
      await fetchCaptures(user.id)

      // 🔥 CONTINUOUS AUTO REFRESH
      interval = setInterval(async () => {
        await fetchCaptures(user.id)
      }, 3000)
    }

    init()

    return () => {
      if (interval) clearInterval(interval)
    }

  }, [])

  if (!user) return <div>Loading...</div>

  return (

    <div style={{ padding: "40px", fontFamily: "Arial" }}>

      <h1>Dashboard</h1>

      <p>Welcome {user.email}</p>

      <button
        onClick={signOut}
        style={{
          float: "right",
          background: "red",
          color: "white",
          border: "none",
          padding: "6px 10px",
          cursor: "pointer"
        }}
      >
        Sign Out
      </button>

      <h2>Add URL</h2>

      <input
        style={{ width: "500px", marginRight: "10px" }}
        placeholder="https://example.com/full-url"
        value={newUrl}
        onChange={(e) => setNewUrl(e.target.value)}
      />

      <select
        value={schedule}
        onChange={(e) => setSchedule(e.target.value)}
        style={{ marginRight: "10px" }}
      >
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="monthly_29">Every 29 days</option>
        <option value="monthly_30">Every 30 days</option>
      </select>

      <button
        onClick={addUrl}
        style={{
          background: "green",
          color: "white",
          padding: "6px 12px",
          border: "none",
          cursor: "pointer"
        }}
      >
        Add URL
      </button>

      <h2 style={{ marginTop: "40px" }}>Tracked URLs</h2>

      <table border={1} cellPadding={6} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>URL</th>
            <th>Schedule</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {urls.map((url) => (
            <tr key={url.id}>
              <td>{url.url}</td>
              <td>{url.schedule_type}</td>
              <td>{new Date(url.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: "40px" }}>Capture History</h2>

      <table border={1} cellPadding={6} style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>URL</th>
            <th>Captured At</th>
            <th>PDF</th>
          </tr>
        </thead>

        <tbody>
          {captures.map((capture: any) => (
            <tr key={capture.id}>
              <td>{capture.url}</td>

              <td>
                {new Date(capture.created_at).toLocaleString("en-CA", {
                  timeZone: "America/Edmonton"
                })}
              </td>

              <td>
                <a
                  const { data } = supabase
                    .storage
                    .from("captures")
                    .getPublicUrl(capture.file_path)

<a href={data.publicUrl} target="_blank">View PDF</a>
                >
                  View PDF
                </a>
              </td>

            </tr>
          ))}
        </tbody>

      </table>

    </div>
  )
}
