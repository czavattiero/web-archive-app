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
  const [search, setSearch] = useState("")
  const [captures, setCaptures] = useState<any[]>([])

  // ✅ SAFE AUTH + SUBSCRIPTION CHECK
  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()

      // ❌ Not logged in → go to signup
      if (!data.user) {
        window.location.href = "/signup"
        return
      }
      
      // TEMP: disable subscription check
// const { data: subscription } = await supabase
//   .from("subscriptions")
//   .select("*")
//   .eq("user_id", data.user.id)
//   .maybeSingle()

// if (!subscription) {
//   window.location.href = "/signup"
//   return
// }

      // ✅ User is valid
      setUser(data.user)
      setLoading(false)

      // ✅ Load data
      fetchData(data.user)
    }

    init()
  }, [])

  // 🔄 Auto refresh
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      fetchData(user)
    }, 5000)

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

    if (!url.trim()) {
      alert("Enter a URL")
      return
    }

    let selectedDate = ""

    if (schedule === "custom") {
      if (!customDate) {
        alert("Select a date")
        return
      }
      selectedDate = customDate
    }

    const now = new Date().toISOString()

    const { error } = await supabase.from("urls").insert([
      {
        url: url.trim(),
        user_id: user.id,
        next_capture_at: now, // 🔥 DO NOT CHANGE
        schedule_type: schedule,
        schedule_value: selectedDate,
        status: "active",
      },
    ])

    if (error) {
      alert("Error adding URL")
      return
    }

    await fetchData(user)

    // 🔥 trigger worker
    await fetch("/api/run-worker", { method: "POST" })

    setUrl("")
    setCustomDate("")
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
  }

  function getUrlById(id: string) {
    return urls.find((u) => u.id === id)
  }

  // ✅ CRITICAL LOADING GUARD
  if (loading) {
    return <div style={{ padding: 40 }}>Loading...</div>
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f6f9fc" }}>
      {/* SIDEBAR */}
      <div
        style={{
          width: 220,
          background: "#0a2540",
          color: "#fff",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <img 
  src="/screenly-logo.png" 
  style={{ width: 140, marginBottom: 20 }} 
/>
          <div style={{ marginTop: 20, fontWeight: "bold" }}>Dashboard</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: 30 }}>
        {/* 🔥 TOP RIGHT BAR */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 20,
            gap: 12,
          }}
        >
          <div>{user?.email}</div>

          <button
            onClick={handleSignOut}
            style={{
              background: "#ef4444",
              color: "#fff",
              padding: "6px 12px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>

        <h1>Dashboard</h1>

        {/* ADD URL */}
        <div style={{ background: "#fff", padding: 20, borderRadius: 10 }}>
          <h3>Add URL</h3>

          <div style={{ display: "flex", gap: 10 }}>
            <div
  style={{
    display: "flex",
    gap: 10,
    alignItems: "center",
  }}
>
  <input
    type="text"
    placeholder="https://example.com"
    value={url}
    onChange={(e) => setUrl(e.target.value)}
    style={{
      flex: 1,
      padding: "12px",
      borderRadius: 10,
      border: "1px solid #E5E7EB",
    }}
  />

  <select
    value={schedule}
    onChange={(e) => setSchedule(e.target.value)}
    style={{
      padding: "12px",
      borderRadius: 10,
      border: "1px solid #E5E7EB",
    }}
  >
    <option value="weekly">Weekly</option>
    <option value="biweekly">Biweekly</option>
    <option value="29days">Every 29 days</option>
    <option value="30days">Every 30 days</option>
    <option value="custom">Specific date</option>
  </select>

  {schedule === "custom" && (
    <input
      type="date"
      value={customDate}
      onChange={(e) => setCustomDate(e.target.value)}
      style={{
        padding: "12px",
        borderRadius: 10,
        border: "1px solid #E5E7EB",
      }}
    />
  )}

  <button
    onClick={addUrl}
    style={{
      background: "#6A11CB",
      color: "white",
      padding: "12px 18px",
      borderRadius: 10,
      border: "none",
      fontWeight: 600,
      cursor: "pointer",
    }}
  >
    Add URL
  </button>
</div>
        {/* TRACKED URLS */}
        <div style={{ marginTop: 20 }}>
          <h3>Tracked URLs</h3>
          <input
  type="text"
  placeholder="🔍 Search your URLs..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    width: "100%",
    padding: "12px 14px",
    margin: "10px 0 20px 0",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    fontSize: 14,
    outline: "none",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  }}
/>
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    width: "100%",
    padding: "10px",
    margin: "10px 0 20px 0",
    borderRadius: 8,
    border: "1px solid #E5E7EB",
  }}
/>

          <table style={{ width: "100%", marginTop: 10 }}>
  <thead>
    <tr>
      <th style={{ textAlign: "left" }}>URL</th>
      <th style={{ textAlign: "left" }}>Schedule</th>
      <th style={{ textAlign: "left" }}>Date Added</th>
    </tr>
  </thead>

  <tbody>
    {urls.length === 0 ? (
      <tr>
        <td colSpan={3}>No URLs yet</td>
      </tr>
    ) : (
      urls
  .filter((u) =>
    u.url.toLowerCase().includes(search.toLowerCase())
  )
  .map((u) => (
        <tr key={u.id}>
          <td>{u.url}</td>

          <td>
            {u.schedule_type === "custom"
              ? `Specific date: ${u.schedule_value}`
              : u.schedule_type === "weekly"
              ? "Every week"
              : u.schedule_type === "biweekly"
              ? "Every 2 weeks"
              : u.schedule_type === "29days"
              ? "Every 29 days"
              : u.schedule_type === "30days"
              ? "Every 30 days"
              : u.schedule_type}
          </td>

          <td>
            {new Date(u.created_at).toLocaleString()}
          </td>
        </tr>
      ))
    )}
  </tbody>
</table>
        </div>

        {/* CAPTURE HISTORY */}
        <div style={{ marginTop: 20 }}>
          <h3>Capture History</h3>

          <table style={{ width: "100%", marginTop: 10 }}>
  <thead>
    <tr>
      <th style={{ textAlign: "left" }}>URL</th>
      <th style={{ textAlign: "left" }}>Captured At</th>
      <th style={{ textAlign: "left" }}>PDF</th>
    </tr>
  </thead>

  <tbody>
    {captures.length === 0 ? (
      <tr>
        <td colSpan={3}>No captures yet</td>
      </tr>
    ) : (
      captures
  .filter((c) => {
    const urlData = getUrlById(c.url_id)
    return urlData?.url
      ?.toLowerCase()
      .includes(search.toLowerCase())
  })
  .map((c) => {
        if (!c.file_path) return null

        const urlData = getUrlById(c.url_id)

        const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

        return (
          <tr key={c.id}>
            <td>{urlData?.url || "Unknown"}</td>
            <td>{new Date(c.created_at).toLocaleString()}</td>
            <td>
              <a href={publicUrl} target="_blank">
                Download
              </a>
            </td>
          </tr>
        )
      })
    )}
  </tbody>
</table>
        </div>
      </div>
    </div>
  )
}
