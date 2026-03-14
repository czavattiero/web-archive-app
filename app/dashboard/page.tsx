"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {

  const [user, setUser] = useState<any>(null)
  const [urlInput, setUrlInput] = useState("")
  const [schedule, setSchedule] = useState("weekly")
  const [specificDate, setSpecificDate] = useState("")
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadUrls()
      loadCaptures()
    }
  }, [user])

  async function loadUser() {
    const { data } = await supabase.auth.getUser()
    setUser(data.user)
  }

  async function loadUrls() {

    const { data } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (data) setUrls(data)
  }

  async function loadCaptures() {

    const { data } = await supabase
      .from("captures")
      .select("*, urls(url)")
      .order("created_at", { ascending: false })
      .limit(20)

    if (data) setCaptures(data)
  }

  async function addUrl() {

    if (!urlInput) return

    let nextCapture = new Date()

    if (schedule === "specific" && specificDate) {
      nextCapture = new Date(specificDate)
    }

    const { error } = await supabase.from("urls").insert({
      url: urlInput,
      user_id: user.id,
      schedule_type: schedule,
      next_capture_at: nextCapture,
      status: "active"
    })

    if (error) {
      console.error("Insert error:", error)
      return
    }

    setUrlInput("")
    setSpecificDate("")

    await loadUrls()
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (

    <div style={{ padding: 30 }}>

      {/* HEADER */}

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Dashboard</h1>

        <button
          onClick={signOut}
          style={{
            background: "red",
            color: "white",
            border: "none",
            padding: "8px 14px",
            cursor: "pointer"
          }}
        >
          Sign Out
        </button>
      </div>

      {user && (
        <p>Welcome {user.email}</p>
      )}

      {/* ADD URL */}

      <h2>Add URL</h2>

      <input
        style={{ width: 400 }}
        placeholder="https://example.com/full-url"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
      />

      <select
        value={schedule}
        onChange={(e) => setSchedule(e.target.value)}
        style={{ marginLeft: 10 }}
      >
        <option value="weekly">Weekly</option>
        <option value="biweekly">Biweekly</option>
        <option value="29days">29 days</option>
        <option value="30days">30 days</option>
        <option value="specific">Specific date</option>
      </select>

      {schedule === "specific" && (
        <input
          type="date"
          value={specificDate}
          onChange={(e) => setSpecificDate(e.target.value)}
          style={{ marginLeft: 10 }}
        />
      )}

      <button
        onClick={addUrl}
        style={{
          marginLeft: 10,
          background: "green",
          color: "white",
          border: "none",
          padding: "6px 12px",
          cursor: "pointer"
        }}
      >
        Add URL
      </button>

      {/* TRACKED URLS */}

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

              <td>
                {u.schedule_type === "specific"
                  ? new Date(u.next_capture_at).toLocaleDateString()
                  : u.schedule_type}
              </td>

              <td>
                {new Date(u.created_at).toLocaleDateString()}
              </td>

            </tr>

          ))}

        </tbody>
      </table>

      {/* CAPTURE HISTORY */}

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
                {new Date(c.created_at).toLocaleString()}
              </td>

              <td>
                <a
                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`}
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
