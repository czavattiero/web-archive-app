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
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      display: "inline-block",
    }

    if (status === "completed")
      return <span style={{ ...base, background: "#EEF2FF", color: "#4F46E5" }}>Completed</span>

    if (status === "active")
      return <span style={{ ...base, background: "#ECFDF5", color: "#059669" }}>Active</span>

    return <span style={{ ...base, background: "#FEF2F2", color: "#DC2626" }}>Failed</span>
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ background: "#FAFAFA", minHeight: "100vh" }}>

      {/* TOP BAR */}
      <div style={topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/screenly-logo.png" style={{ width: 110 }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: "#6B7280" }}>
            Dashboard
          </span>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#6B7280" }}>{user.email}</span>
          <button onClick={handleLogout} style={logoutBtn}>
            Sign Out
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>

        <h1 style={title}>Monitored URLs</h1>

        {/* ADD URL */}
        <div style={card}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste job posting URL..."
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

            <button onClick={addUrl} style={addBtn}>
              Add
            </button>
          </div>
        </div>

        {/* TABLE */}
        <div style={tableCard}>

          <input
            placeholder="Search URLs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />

          <div style={tableHeader}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Schedule</div>
            <div style={{ flex: 1 }}>Next</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>Added</div>
          </div>

          {urls
            .filter((u) => u.url.toLowerCase().includes(search.toLowerCase()))
            .map((u) => (
              <div key={u.id} style={rowHover}>
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
  padding: "14px 28px",
  borderBottom: "1px solid #E5E7EB",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
}

const title = {
  fontSize: 22,
  fontWeight: 600,
  marginBottom: 20,
  color: "#111827"
}

const card = {
  background: "#fff",
  padding: 16,
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  marginBottom: 20
}

const tableCard = {
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  overflow: "hidden"
}

const tableHeader = {
  display: "flex",
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 600,
  color: "#6B7280",
  borderBottom: "1px solid #E5E7EB"
}

const rowHover = {
  display: "flex",
  padding: "14px 16px",
  fontSize: 14,
  borderBottom: "1px solid #F3F4F6",
  alignItems: "center",
  cursor: "default",
  transition: "background 0.2s ease"
}

rowHover[":hover"] = {
  background: "#F9FAFB"
}

const input = {
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  fontSize: 14,
  width: "100%",
  background: "#fff"
}

const searchInput = {
  width: "100%",
  padding: "10px 14px",
  border: "none",
  borderBottom: "1px solid #E5E7EB",
  outline: "none",
  fontSize: 14
}

const addBtn = {
  background: "#111827",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 8,
  fontWeight: 600,
  cursor: "pointer"
}

const logoutBtn = {
  background: "#EF4444",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer"
}
