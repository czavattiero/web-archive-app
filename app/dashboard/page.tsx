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

    let nextCapture: Date

    if (schedule === "custom") {
      if (!customDate) return alert("Select a date")

      nextCapture = new Date(
        new Date(customDate).toLocaleString("en-US", {
          timeZone: "America/Edmonton",
        })
      )
      nextCapture.setHours(9, 0, 0, 0)
    } else {
      nextCapture = new Date()
    }

    const { error } = await supabase.from("urls").insert([
      {
        url: url.trim(),
        user_id: user.id,
        next_capture_at: nextCapture.toISOString(),
        schedule_type: schedule,
        schedule_value: schedule === "custom" ? customDate : null,
        status: "active",
      },
    ])

    if (error) return alert("Error adding URL")

    if (schedule !== "custom") {
      await fetch("/api/run-worker", { method: "POST" })
    }

    setUrl("")
    setCustomDate("")
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = "/"
  }

  function getUrlById(id: string) {
    return urls.find((u) => u.id === id)
  }

  function formatAlbertaTime(dateString: string | null) {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("en-CA", {
      timeZone: "America/Edmonton",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function StatusBadge({ status }: { status: string }) {
    const base = {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
    }

    if (status === "active")
      return <span style={{ ...base, background: "#DCFCE7", color: "#166534" }}>Active</span>

    if (status === "completed")
      return <span style={{ ...base, background: "#E0E7FF", color: "#3730A3" }}>Completed</span>

    if (status === "failed")
      return <span style={{ ...base, background: "#FEE2E2", color: "#991B1B" }}>Failed</span>

    return <span style={{ ...base, background: "#eee" }}>{status}</span>
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ background: "#F8FAFC", minHeight: "100vh" }}>

      {/* TOP NAV */}
      <div style={{
        background: "#fff",
        padding: "16px 30px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #eee"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/screenly-logo.png" style={{ width: 120 }} />
          <span style={{ fontWeight: 600 }}>Dashboard</span>
        </div>

        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
          <span style={{ fontSize: 14 }}>{user.email}</span>
          <button onClick={handleLogout} style={logoutBtn}>Sign Out</button>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: 30, maxWidth: 1200, margin: "auto" }}>

        {/* HEADER */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20
        }}>
          <h2 style={{ fontSize: 22 }}>Monitored URLs</h2>

          <button style={primaryBtn} onClick={addUrl}>
            + Add URL
          </button>
        </div>

        {/* INPUT BAR */}
        <div style={card}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              placeholder="Paste URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ ...input, flex: 2 }}
            />

            <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={input}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="29days">Every 29 days</option>
              <option value="30days">Every 30 days</option>
              <option value="custom">Specific date</option>
            </select>

            {schedule === "custom" && (
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} style={input} />
            )}
          </div>
        </div>

        {/* TABLE */}
        <div style={card}>
          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...input, marginBottom: 15 }}
          />

          {/* HEADERS */}
          <div style={tableHeader}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Schedule</div>
            <div style={{ flex: 1 }}>Next Capture</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>Added</div>
          </div>

          {urls
            .filter((u) => u.url.toLowerCase().includes(search.toLowerCase()))
            .map((u) => (
              <div key={u.id} style={row}>
                <div style={{ flex: 3, wordBreak: "break-all" }}>{u.url}</div>
                <div style={{ flex: 1 }}>{u.schedule_type}</div>
                <div style={{ flex: 1 }}>{formatAlbertaTime(u.next_capture_at)}</div>
                <div style={{ flex: 1 }}><StatusBadge status={u.status} /></div>
                <div style={{ flex: 1 }}>{formatAlbertaTime(u.created_at)}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

/* STYLES */

const card = {
  background: "#fff",
  padding: 20,
  borderRadius: 14,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  marginBottom: 20
}

const tableHeader = {
  display: "flex",
  fontWeight: 600,
  fontSize: 13,
  color: "#6B7280",
  marginBottom: 10
}

const row = {
  display: "flex",
  padding: "12px 0",
  borderTop: "1px solid #f1f1f1"
}

const input = {
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  width: "100%"
}

const primaryBtn = {
  background: "linear-gradient(135deg,#7C3AED,#9333EA)",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600
}

const logoutBtn = {
  background: "#ef4444",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer"
}
