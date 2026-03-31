"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)

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
    if (!url.trim()) return alert("Enter a URL")

    let selectedDate = ""

    if (schedule === "custom") {
      if (!customDate) return alert("Select a date")
      selectedDate = customDate
    }

    const now = new Date().toISOString()

    const { error } = await supabase.from("urls").insert([
      {
        url: url.trim(),
        user_id: user.id,
        next_capture_at: now,
        schedule_type: schedule,
        schedule_value: selectedDate,
        status: "active",
      },
    ])

    if (error) return alert("Error adding URL")

    await fetch("/api/run-worker", { method: "POST" })

    setIsCapturing(true)

    setTimeout(async () => {
      await fetchData(user)
      setIsCapturing(false)
    }, 8000)

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

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F7FB" }}>
      
      {/* SIDEBAR */}
      <div style={{
        width: 240,
        background: "#0F172A",
        color: "#fff",
        padding: 24
      }}>
        <img src="/screenly-logo.png" style={{ width: 160 }} />
        <div style={{ marginTop: 30, fontWeight: "bold" }}>Dashboard</div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: 40 }}>
        
        {/* TOP BAR */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <div>{user?.email}</div>
          <button onClick={handleLogout} style={buttonDanger}>
            Sign Out
          </button>
        </div>

        <h1 style={{ fontSize: 28, marginBottom: 20 }}>Dashboard</h1>

        {isCapturing && (
          <p style={{ color: "#6b7280" }}>Capturing... ⏳</p>
        )}

        {/* ADD URL */}
        <div style={cardStyle}>
          <h3>Add URL</h3>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={inputStyle}
            />

            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              style={inputStyle}
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
                style={inputStyle}
              />
            )}

            <button onClick={addUrl} style={buttonPrimary}>
              Add URL
            </button>
          </div>
        </div>

        {/* TRACKED URLS */}
        <div style={cardStyle}>
          <h3>Tracked URLs</h3>

          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchStyle}
          />

          <div style={headerRow}>
            <div style={{ flex: 2 }}>URL</div>
            <div style={{ flex: 1 }}>Schedule</div>
            <div style={{ flex: 1 }}>Date Added</div>
          </div>

          {urls
            .filter((u) =>
              u.url.toLowerCase().includes(search.toLowerCase())
            )
            .map((u) => (
              <div key={u.id} style={rowCard}>
                <div style={{ flex: 2 }}>{u.url}</div>

                <div style={{ flex: 1 }}>
                  {u.schedule_type === "custom"
                    ? `Specific: ${u.schedule_value}`
                    : u.schedule_type === "weekly"
                    ? "Weekly"
                    : u.schedule_type === "biweekly"
                    ? "Biweekly"
                    : u.schedule_type === "29days"
                    ? "Every 29 days"
                    : u.schedule_type === "30days"
                    ? "Every 30 days"
                    : u.schedule_type}
                </div>

                <div style={{ flex: 1 }}>
                  {new Date(u.created_at).toLocaleString()}
                </div>
              </div>
            ))}
        </div>

        {/* CAPTURE HISTORY */}
        <div style={cardStyle}>
          <h3>Capture History</h3>

          <div style={headerRow}>
            <div style={{ flex: 2 }}>URL</div>
            <div style={{ flex: 1 }}>Captured At</div>
            <div style={{ flex: 1 }}>PDF</div>
          </div>

          {captures.map((c) => {
            if (!c.file_path) return null

            const urlData = getUrlById(c.url_id)
            const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

            return (
              <div key={c.id} style={rowCard}>
                <div style={{ flex: 2 }}>{urlData?.url}</div>

                <div style={{ flex: 1 }}>
                  {new Date(c.created_at).toLocaleString()}
                </div>

                <div style={{ flex: 1 }}>
                  <a href={publicUrl} target="_blank" style={linkStyle}>
                    Download
                  </a>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

/* STYLES */

const cardStyle = {
  background: "#fff",
  padding: 24,
  borderRadius: 16,
  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
  marginTop: 20
}

const rowCard = {
  display: "flex",
  padding: "14px 16px",
  marginTop: 10,
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.04)"
}

const headerRow = {
  display: "flex",
  padding: "10px 16px",
  marginTop: 10,
  color: "#6B7280",
  fontWeight: 600,
  fontSize: 13,
}

const inputStyle = {
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB"
}

const searchStyle = {
  width: "100%",
  padding: "12px",
  marginTop: 10,
  borderRadius: 10,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB"
}

const buttonPrimary = {
  background: "linear-gradient(135deg, #7C3AED, #9333EA)",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  cursor: "pointer"
}

const buttonDanger = {
  background: "#ef4444",
  color: "#fff",
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer"
}

const linkStyle = {
  color: "#7C3AED",
  fontWeight: 500
}
