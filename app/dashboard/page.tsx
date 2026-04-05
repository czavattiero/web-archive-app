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
      .select(`
        id,
        file_path,
        created_at,
        url_id,
        urls (url)
      `)
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!user) return
    if (!url.trim()) return alert("Enter a URL")

    const nextCaptureISO = new Date().toISOString()

    const { error } = await supabase.from("urls").insert([
      {
        url: url.trim(),
        user_id: user.id,
        next_capture_at: nextCaptureISO,
        schedule_type: schedule,
        schedule_value: schedule === "custom" ? customDate : null,
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = "/"
  }

  function formatAlbertaTime(dateString: string | null) {
    if (!dateString) return "—"

    return DateTime.fromISO(dateString, { zone: "utc" })
      .setZone("America/Edmonton")
      .toFormat("MMM d, yyyy, h:mm a")
  }

  function StatusBadge({ status }: { status: string }) {
    const base = {
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      display: "inline-block",
    }

    if (status === "active")
      return <span style={{ ...base, background: "#DCFCE7", color: "#166534" }}>Active</span>

    if (status === "completed")
      return <span style={{ ...base, background: "#E0E7FF", color: "#3730A3" }}>Completed</span>

    if (status === "failed")
      return <span style={{ ...base, background: "#FEE2E2", color: "#991B1B" }}>Failed</span>

    return <span style={{ ...base, background: "#E5E7EB", color: "#374151" }}>{status}</span>
  }

  const filteredUrls = urls.filter((u) =>
    u.url.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCaptures = captures.filter((c) =>
    c.urls?.url?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>

      {/* TOP BAR */}
      <div style={topBar}>
        <img src="/screenly-logo.png" style={{ width: 140 }} />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 14 }}>{user?.email}</div>

          <button
            onClick={async () => {
              const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
              })

              const data = await res.json()
              if (data.url) window.location.href = data.url
            }}
            style={buttonPrimary}
          >
            Manage billing
          </button>

          <button onClick={handleLogout} style={buttonDanger}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ padding: 40, maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Add URL</h3>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={{ ...inputStyle, flex: 2 }}
            />

            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
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
                style={{ ...inputStyle, flex: 1 }}
              />
            )}

            <button onClick={addUrl} style={buttonPrimary}>
              Add
            </button>
          </div>
        </div>

        {/* TRACKED URLS */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Tracked URLs</h3>

          <input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchStyle}
          />

          {filteredUrls.map((u) => (
            <div key={u.id} style={rowCard}>
              <div style={urlCell}>{u.url}</div>
              <div>{u.schedule_type}</div>
              <div>{formatAlbertaTime(u.next_capture_at)}</div>
              <div><StatusBadge status={u.status} /></div>
              <div>{formatAlbertaTime(u.created_at)}</div>
            </div>
          ))}
        </div>

        {/* CAPTURE HISTORY */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Capture History</h3>

          {filteredCaptures.map((c) => {
            if (!c.file_path) return null

            const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

            return (
              <div key={c.id} style={rowCard}>
                <div style={urlCell}>{c.urls?.url}</div>
                <div>{formatAlbertaTime(c.created_at)}</div>
                <div><StatusBadge status="completed" /></div>
                <div>
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

/* ✅ STYLES OUTSIDE COMPONENT */

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  padding: "20px 40px",
  borderBottom: "1px solid #eee"
}

const title = { fontSize: 26, fontWeight: 700 }

const cardStyle = {
  background: "#fff",
  padding: 24,
  borderRadius: 14,
  border: "1px solid #eee",
  marginTop: 20
}

const sectionTitle = { fontSize: 16, fontWeight: 600 }

const rowCard = {
  display: "flex",
  padding: 12,
  borderBottom: "1px solid #eee",
  gap: 12
}

const urlCell = {
  flex: 3,
  wordBreak: "break-all"
}

const inputStyle = {
  padding: 10,
  border: "1px solid #ddd",
  borderRadius: 8
}

const searchStyle = {
  width: "100%",
  padding: 10,
  marginBottom: 10
}

const buttonPrimary = {
  background: "#7C3AED",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 8
}

const buttonDanger = {
  background: "red",
  color: "#fff",
  padding: "6px 12px",
  borderRadius: 6
}

const linkStyle = {
  color: "#7C3AED"
}
