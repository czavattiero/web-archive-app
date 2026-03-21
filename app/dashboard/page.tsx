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
    const { data } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    setUrls(data || [])
  }

  // ✅ FIXED FETCH CAPTURES (NO JOIN)
  async function fetchCaptures(userId: string) {

    // get user's URLs
    const { data: userUrls } = await supabase
      .from("urls")
      .select("id, url")
      .eq("user_id", userId)

    if (!userUrls) return

    const urlMap = new Map(userUrls.map(u => [u.id, u.url]))
    const urlIds = userUrls.map(u => u.id)

    if (urlIds.length === 0) {
      setCaptures([])
      return
    }

    // get captures
    const { data: cap } = await supabase
      .from("captures")
      .select("*")
      .in("url_id", urlIds)
      .order("created_at", { ascending: false })

    if (!cap) return

    // attach URL manually
    const formatted = cap.map((c: any) => ({
      ...c,
      url: urlMap.get(c.url_id)
    }))

    setCaptures(formatted)
  }

  // ✅ ADD URL
  async function addUrl() {
    if (!newUrl || !user) return

    await supabase.from("urls").insert({
      url: newUrl,
      user_id: user.id,
      schedule_type: schedule,
      next_capture_at: new Date().toISOString()
    })

    setNewUrl("")
    await fetchUrls(user.id)

    // trigger worker
    await fetch("/api/capture", { method: "POST" })

    // quick refresh loop
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 2000))
      await fetchCaptures(user.id)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  useEffect(() => {
    let interval: any

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUser(user)

      await fetchUrls(user.id)
      await fetchCaptures(user.id)

      // 🔥 live updates
      interval = setInterval(() => {
        fetchCaptures(user.id)
      }, 3000)
    }

    init()

    return () => clearInterval(interval)
  }, [])

  if (!user) return <div>Loading...</div>

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>

      <h1>Dashboard</h1>
      <p>Welcome {user.email}</p>

      <button onClick={signOut} style={{
        float: "right",
        background: "red",
        color: "white",
        padding: "6px 10px"
      }}>
        Sign Out
      </button>

      <h2>Add URL</h2>

      <input
        style={{ width: "500px", marginRight: "10px" }}
        value={newUrl}
        onChange={(e) => setNewUrl(e.target.value)}
      />

      <select
        value={schedule}
        onChange={(e) => setSchedule(e.target.value)}
      >
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
      </select>

      <button onClick={addUrl} style={{
        background: "green",
        color: "white",
        marginLeft: "10px"
      }}>
        Add URL
      </button>

      <h2 style={{ marginTop: "40px" }}>Tracked URLs</h2>

      <table border={1} cellPadding={6} style={{ width: "100%" }}>
        <tbody>
          {urls.map((u) => (
            <tr key={u.id}>
              <td>{u.url}</td>
              <td>{u.schedule_type}</td>
              <td>{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: "40px" }}>Capture History</h2>

      <table border={1} cellPadding={6} style={{ width: "100%" }}>
        <tbody>
          {captures.map((c: any) => (
            <tr key={c.id}>
              <td>{c.url}</td>
              <td>
                {new Date(c.created_at).toLocaleString("en-CA", {
                  timeZone: "America/Edmonton"
                })}
              </td>
              <td>
                {c.file_path && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`}
                    target="_blank"
                  >
                    View PDF
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  )
}
