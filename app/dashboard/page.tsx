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

    if (error) {
      console.error("❌ Error fetching URLs:", error)
      return
    }

    setUrls(data || [])
  }

  // ✅ FETCH CAPTURES
  async function fetchCaptures(userId: string) {

    const { data, error } = await supabase
      .from("captures")
      .select(`
        id,
        file_path,
        captured_at,
        urls (
          id,
          url,
          user_id
        )
      `)
      .order("captured_at", { ascending: false })

    if (error) {
      console.error("❌ Error loading captures:", error)
      return
    }

    if (!data) return

    const filtered = data.filter(
      (capture: any) => capture.urls?.user_id === userId
    )

    setCaptures(filtered)
  }

  // ✅ ADD URL (FIXED)
  async function addUrl() {

  if (!newUrl || !user) return

  console.log("🚀 Adding URL:", newUrl)

  const { error } = await supabase
    .from("urls")
    .insert({
      url: newUrl,
      user_id: user.id,
      schedule_type: schedule,
      next_capture_at: new Date().toISOString()
    })

  if (error) {
    console.error("❌ Insert failed:", error)
    return
  }

  console.log("✅ URL added")

  setNewUrl("")
  await fetchUrls(user.id)

  // ✅ CALL YOUR EXISTING API ROUTE
  try {
    const res = await fetch("/api/capture", {
      method: "POST"
    })

    const data = await res.json()

    console.log("⚡ Trigger response:", data)

  } catch (err) {
    console.error("❌ Trigger failed:", err)
  }

  // immediate refresh attempt
await fetchCaptures(user.id)
}

  // ✅ SIGN OUT
  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  // ✅ INITIAL LOAD
  useEffect(() => {

  let interval: any

  const init = async () => {

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    setUser(user)

    // initial load
    await fetchUrls(user.id)
    await fetchCaptures(user.id)

    // 🔥 aggressive polling (every 3 seconds)
    interval = setInterval(async () => {
      console.log("🔄 polling for new captures...")

      const { data, error } = await supabase
        .from("captures")
        .select(`
          id,
          file_path,
          captured_at,
          urls (
            id,
            url,
            user_id
          )
        `)
        .order("captured_at", { ascending: false })

      if (!error && data) {

        const filtered = data.filter(
          (c: any) => c.urls?.user_id === user.id
        )

        // 🔥 FORCE STATE UPDATE (important)
        setCaptures([...filtered])
      }

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
              <td>{capture.urls?.url}</td>

              <td>
                {new Date(capture.captured_at).toLocaleString("en-CA", {
                  timeZone: "America/Edmonton"
                })}
              </td>

              <td>
                <a
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${capture.file_path}`}
                  target="_blank"
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
