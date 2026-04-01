"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

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

  async function fetchData(currentUser: any) {
    const { data: urlsData } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", currentUser.id)

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .eq("user_id", currentUser.id)

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!user || !url.trim()) return

    await supabase.from("urls").insert([
      {
        url: url.trim(),
        user_id: user.id,
        schedule_type: schedule,
        schedule_value: schedule === "custom" ? customDate : null,
        next_capture_at: new Date().toISOString(),
        status: "active",
      },
    ])

    // 🔥 ALWAYS trigger worker
    await fetch("/api/run-worker", { method: "POST" })

    setUrl("")
    setCustomDate("")
    fetchData(user)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  function getUrlById(id: string) {
    return urls.find((u) => u.id === id)
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleString("en-CA", {
      timeZone: "America/Edmonton",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function StatusBadge({ status }: any) {
    if (status === "completed") return <span style={{ color: "green" }}>Completed</span>
    if (status === "active") return <span style={{ color: "blue" }}>Active</span>
    return <span style={{ color: "red" }}>Failed</span>
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  // ✅ FILTER BOTH
  const filteredUrls = urls.filter((u) =>
    u.url.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCaptures = captures.filter((c) => {
    const urlData = getUrlById(c.url_id)
    return urlData?.url?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div style={{ padding: 40 }}>

      <h1>Dashboard</h1>

      <button onClick={handleLogout}>Logout</button>

      {/* ADD URL */}
      <div>
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
        <select value={schedule} onChange={(e) => setSchedule(e.target.value)}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="custom">Custom</option>
        </select>

        {schedule === "custom" && (
          <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} />
        )}

        <button onClick={addUrl}>Add</button>
      </div>

      {/* SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* TRACKED URLS */}
      <h2>Tracked URLs</h2>
      {filteredUrls.map((u) => (
        <div key={u.id}>
          {u.url} | {u.schedule_type} | {formatTime(u.next_capture_at)} | <StatusBadge status={u.status} />
        </div>
      ))}

      {/* CAPTURE HISTORY */}
      <h2>Capture History</h2>
      {filteredCaptures.map((c) => {
        const urlData = getUrlById(c.url_id)
        return (
          <div key={c.id}>
            {urlData?.url} | {formatTime(c.created_at)} | <StatusBadge status={c.status} />
          </div>
        )
      })}
    </div>
  )
}
