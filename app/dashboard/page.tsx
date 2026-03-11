"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {

  const [user, setUser] = useState<any>(null)
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [schedule, setSchedule] = useState("weekly")

  useEffect(() => {
    loadUser()
  }, [])

  async function loadUser() {

    const { data } = await supabase.auth.getUser()

    if (!data?.user) return

    setUser(data.user)

    fetchUrls(data.user.id)
    fetchCaptures(data.user.id)
  }

  async function fetchUrls(userId: string) {

    const { data } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    setUrls(data || [])
  }

  async function fetchCaptures(userId: string) {

    const { data } = await supabase
      .from("captures")
      .select(`
        *,
        urls (
          url,
          user_id
        )
      `)
      .order("captured_at", { ascending: false })

    const userCaptures =
      data?.filter((c: any) => c.urls?.user_id === userId) || []

    setCaptures(userCaptures)
  }

  async function addUrl() {

    if (!newUrl || !user) return

    await fetch("/api/capture", {
      method: "POST",
      body: JSON.stringify({
        url: newUrl,
        user_id: user.id,
        schedule_type: schedule
      })
    })

    setNewUrl("")

    fetchUrls(user.id)
    fetchCaptures(user.id)
  }

  async function signOut() {

    await supabase.auth.signOut()

    window.location.href = "/"
  }

  function getPdfUrl(filePath: string) {

    const { data } = supabase
      .storage
      .from("captures")
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  return (
    <div style={{ padding: 40 }}>

      <h1>Dashboard</h1>

      {user && <p>Welcome {user.email}</p>}

      <button
        onClick={signOut}
        style={{
          float: "right",
          background: "red",
          color: "white",
          padding: "6px 12px"
        }}
      >
        Sign Out
      </button>

      <h2>Add URL</h2>

      <input
        type="text"
        placeholder="https://example.com/full-url"
        value={newUrl}
        onChange={(e) => setNewUrl(e.target.value)}
        style={{ width: "600px", padding: "8px" }}
      />

      <br /><br />

      <select
        value={schedule}
        onChange={(e) => setSchedule(e.target.value)}
      >
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="29_days">29 Days</option>
        <option value="30_days">30 Days</option>
      </select>

      <br /><br />

      <button
        onClick={addUrl}
        style={{
          background: "green",
          color: "white",
          padding: "8px 16px"
        }}
      >
        Add URL
      </button>

      <h2 style={{ marginTop: 40 }}>Tracked URLs</h2>

      <table border={1} cellPadding={10} width="100%">
        <thead>
          <tr>
            <th>URL</th>
            <th>Schedule</th>
            <th>Created</th>
          </tr>
        </thead>

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

      <h2 style={{ marginTop: 40 }}>Capture History</h2>

      <table border={1} cellPadding={10} width="100%">
        <thead>
          <tr>
            <th>URL</th>
            <th>Captured At</th>
            <th>PDF</th>
          </tr>
        </thead>

        <tbody>

          {captures.map((c) => (

            <tr key={c.id}>

              <td>{c.urls?.url}</td>

              <td>
                {c.captured_at
                  ? new Date(c.captured_at).toLocaleString()
                  : ""}
              </td>

              <td>
                {c.file_path && (
                  <a
                    href={getPdfUrl(c.file_path)}
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
