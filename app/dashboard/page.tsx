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
    const { data } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", currentUser.id)

    setUrls(data || [])
  }

  async function addUrl() {
    if (!user || !url.trim()) return

    const { error } = await supabase.from("urls").insert([
      {
        url: url.trim(),
        user_id: user.id,
        schedule_type: schedule,
        schedule_value: schedule === "custom" ? customDate : null,
        next_capture_at: new Date().toISOString(),
        status: "active",
      },
    ])

    if (error) return alert("Error")

    setUrl("")
    setCustomDate("")
    fetchData(user)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/"
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

  function Status({ status }: any) {
    const base = {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
    }

    if (status === "completed")
      return <span style={{ ...base, background: "#EEF2FF", color: "#4338CA" }}>Completed</span>

    if (status === "active")
      return <span style={{ ...base, background: "#ECFDF5", color: "#047857" }}>Active</span>

    return <span style={{ ...base, background: "#FEE2E2", color: "#991B1B" }}>Failed</span>
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ background: "#F9FAFB", minHeight: "100vh" }}>

      {/* TOP BAR */}
      <div style={topBar}>
        <img src="/screenly-logo.png" style={{ width: 120 }} />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#555" }}>{user.email}</span>
          <button onClick={handleLogout} style={logoutBtn}>Sign Out</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>

        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={card}>
          <h3 style={sectionTitle}>Add URL</h3>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/job-posting"
              style={{ ...input, flex: 2 }}
            />

            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              style={input}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="custom">Specific date</option>
            </select>

            {schedule === "custom" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={input}
              />
            )}

            <button onClick={addUrl} style={addBtn}>Add</button>
          </div>
        </div>

        {/* TRACKED URLS */}
        <div style={card}>
          <h3 style={sectionTitle}>Tracked URLs</h3>

          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, marginBottom: 15 }}
          />

          {/* HEADERS */}
          <div style={headerRow}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Schedule</div>
            <div style={{ flex: 1 }}>Next</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>Added</div>
          </div>

          {urls
            .filter((u) => u.url.toLowerCase().includes(search.toLowerCase()))
            .map((u) => (
              <div key={u.id} style={row}>
                <div style={{ flex: 3, wordBreak: "break-word" }}>{u.url}</div>
                <div style={{ flex: 1 }}>{u.schedule_type}</div>
                <div style={{ flex: 1 }}>{formatTime(u.next_capture_at)}</div>
                <div style={{ flex: 1 }}><Status status={u.status} /></div>
                <div style={{ flex: 1 }}>{formatTime(u.created_at)}</div>
              </div>
            ))}
        </div>

      </div>
    </div>
  )
}

/* STYLES */

const topBar = {
  background: "#fff",
  padding: "16px 30px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #eee"
}

const title = {
  fontSize: 26,
  fontWeight: 700,
  marginBottom: 20,
  color: "#111827"
}

const card = {
  background: "#fff",
  padding: 20,
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 20
}

const sectionTitle = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 12
}

const headerRow = {
  display: "flex",
  fontSize: 12,
  color: "#6B7280",
  fontWeight: 600,
  marginBottom: 8
}

const row = {
  display: "flex",
  padding: "12px 0",
  borderTop: "1px solid #f3f4f6",
  fontSize: 14,
  alignItems: "center"
}

const input = {
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  width: "100%",
  fontSize: 14
}

const addBtn = {
  background: "#7C3AED",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer"
}

const logoutBtn = {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer"
}
