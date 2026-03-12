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

  async function fetchUrls(userId: string) {

    const { data, error } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setUrls(data || [])
  }

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
      console.error("Error loading captures:", error)
      return
    }

    if (!data) return

    const filtered = data.filter(
      (capture: any) => capture.urls?.user_id === userId
    )

    setCaptures(filtered)
  }

  async function addUrl() {

  if (!newUrl || !user) return

  const { error } = await supabase
    .from("urls")
    .insert({
      url: newUrl,
      user_id: user.id,
      schedule_type: schedule,
      next_capture: new Date().toISOString()
    })

  if (error) {
    console.error(error)
    return
  }

  setNewUrl("")

  await fetchUrls(user.id)

  setTimeout(async () => {
    await fetchCaptures(user.id)
  }, 8000)

}

  async function signOut() {

    await supabase.auth.signOut()

    window.location.href = "/"
  }

  useEffect(() => {

    const loadData = async () => {

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setUser(user)

      await fetchUrls(user.id)

      await fetchCaptures(user.id)

    }

    loadData()

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
        <option value="29 days">29 days</option>
        <option value="30 days">30 days</option>
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
