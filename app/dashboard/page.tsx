"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { DateTime } from "luxon"

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [url, setUrl] = useState("")
  const [schedule, setSchedule] = useState("weekly")
  const [customDate, setCustomDate] = useState("")

  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.replace("/signup")
        return
      }

      setUser(data.user)
      setLoading(false)
      fetchData(data.user)
    }

    init()
  }, [router])

  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => fetchData(user), 5000)
    return () => clearInterval(interval)
  }, [user])

  async function fetchData(currentUser: any) {
    const { data: urlsData } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", currentUser.id)

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!user) return
    if (!url.trim()) return alert("Enter a URL")

    let scheduleValueISO = null

    if (schedule === "custom" && customDate) {
      scheduleValueISO = DateTime.fromISO(customDate, {
        zone: "America/Edmonton",
      })
        .set({ hour: 9 })
        .toUTC()
        .toISO()
    }

    const now = new Date().toISOString()

const { error } = await supabase.from("urls").insert([
  {
    url: url.trim(),
    user_id: user.id,

    // 🔥 FORCE IMMEDIATE CAPTURE
    next_capture_at: now,
    last_captured_at: null,

    schedule_type: schedule,
    schedule_value: scheduleValueISO,

    status: "active",
  },
])

    if (error) {
      console.error(error)
      return alert(error.message)
    }

    await fetch("/api/capture", { method: "POST" })

    setUrl("")
    setCustomDate("")
    fetchData(user)
  }

  function formatTime(date: string | null) {
    if (!date) return "-"
    return DateTime.fromISO(date, { zone: "utc" })
      .setZone("America/Edmonton")
      .toFormat("MMM d, yyyy, h:mm a")
  }

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: 40 }}>
      <h1>Dashboard</h1>

      {/* ADD URL */}
      <div style={{ marginTop: 20 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL"
        />

        <select
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="29days">29 days</option>
          <option value="30days">30 days</option>
          <option value="custom">Specific date</option>
        </select>

        {schedule === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
          />
        )}

        <button onClick={addUrl}>Add</button>
      </div>

      {/* URLS */}
      <div style={{ marginTop: 40 }}>
        <h3>Tracked URLs</h3>

        {urls.map((u) => (
          <div key={u.id}>
            {u.url} — {formatTime(u.next_capture_at)}
          </div>
        ))}
      </div>

            {/* CAPTURES */}
      <div style={{ marginTop: 40 }}>
        <h3>Capture History</h3>

        {captures.map((c) => (
          <div key={c.id}>
            {formatTime(c.created_at)} — {c.status}
          </div>
        ))}
      </div>
    </div>
  )
}