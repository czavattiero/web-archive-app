"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [url, setUrl] = useState("")
  const [schedule, setSchedule] = useState("weekly")
  const [customDate, setCustomDate] = useState("")

  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])

  // 🔐 Load user
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push("/login")
        return
      }

      setUser(data.user)
      setLoadingUser(false)
      fetchData(data.user)
    }

    loadUser()
  }, [])

  // 🔄 Auto refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (user) fetchData(user)
    }, 5000)

    return () => clearInterval(interval)
  }, [user])

  async function fetchData(currentUser: any) {
    if (!currentUser) return

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
    if (!user || !url) return

    if (schedule === "custom" && !customDate) {
      alert("Please select a date")
      return
    }

    const now = new Date().toISOString()

    const { error } = await supabase.from("urls").insert([
      {
        url,
        user_id: user.id,
        next_capture_at: now, // 🔥 ALWAYS NOW
        schedule_type: schedule,
        schedule_value: schedule === "custom" ? customDate : null,
        status: "active",
      },
    ])

    if (error) {
      console.error("❌ Insert error:", error)
      return
    }

    // ⚡ Instant UI update
    fetchData(user)

    // ⚡ Trigger worker immediately
    try {
      await fetch("/api/run-worker", { method: "POST" })
    } catch (err) {
      console.error("Worker trigger failed:", err)
    }

    setUrl("")
    setCustomDate("")
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  function getUrlById(id: string) {
    return urls.find((u) => u.id === id)
  }

  if (loadingUser) {
    return <div style={{ padding: 40 }}>Loading...</div>
  }

  return (
    <div style={layout}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <div>
          <h2 style={logo}>WebArchive</h2>
          <div style={menuActive}>Dashboard</div>
        </div>

        <button onClick={handleSignOut} style={logoutButton}>
          Sign Out
        </button>
      </div>

      {/* MAIN */}
      <div style={main}>
        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={card}>
          <h3 style={cardTitle}>Add URL</h3>

          <div style={row}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={input}
            />

            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              style={select}
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
                style={input}
              />
            )}

            <button onClick={addUrl} style={button}>
              Add URL
            </button>
          </div>
        </div>

        {/* TRACKED URLS */}
        <div style={card}>
          <h3 style={cardTitle}>Tracked URLs</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>Schedule</th>
                <th style={th}>Date Added</th>
              </tr>
            </thead>

            <tbody>
              {urls.length === 0 ? (
                <tr>
                  <td colSpan={3} style={empty}>
                    No URLs yet
                  </td>
                </tr>
              ) : (
                urls.map((u) => (
                  <tr key={u.id}>
                    <td style={td}>{u.url}</td>
                    <td style={td}>{u.schedule_type}</td>
                    <td style={td}>
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CAPTURE HISTORY */}
        <div style={card}>
          <h3 style={cardTitle}>Capture History</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>Captured At</th>
                <th style={th}>PDF</th>
              </tr>
            </thead>

            <tbody>
              {captures.length === 0 ? (
                <tr>
                  <td colSpan={3} style={empty}>
                    No captures yet
                  </td>
                </tr>
              ) : (
                captures.map((c) => {
                  if (!c.file_path) return null

                  const urlData = getUrlById(c.url_id)

                  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

                  return (
                    <tr key={c.id}>
                      <td style={td}>{urlData?.url || "Unknown"}</td>
                      <td style={td}>
                        {new Date(c.created_at).toLocaleString()}
                      </td>
                      <td style={td}>
                        <a href={publicUrl} target="_blank" style={link}>
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

/* STYLES */

const layout: React.CSSProperties = {
  display: "flex",
  background: "#f6f9fc",
  minHeight: "100vh",
}

const sidebar: React.CSSProperties = {
  width: "220px",
  background: "#0a2540",
  color: "#fff",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  height: "100vh",
}

const logo = { marginBottom: "30px" }
const menuActive = { padding: "10px 0", fontWeight: "bold" }

const logoutButton: React.CSSProperties = {
  background: "#ff4d4f",
  color: "#fff",
  padding: "10px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
}

const main: React.CSSProperties = { flex: 1, padding: "30px" }
const title: React.CSSProperties = { fontSize: "24px", marginBottom: "20px" }

const card: React.CSSProperties = {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
  marginBottom: "20px",
}

const cardTitle = { marginBottom: "10px" }
const row: React.CSSProperties = { display: "flex", gap: "10px" }

const input: React.CSSProperties = {
  flex: 1,
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd",
}

const select: React.CSSProperties = {
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd",
}

const button: React.CSSProperties = {
  background: "#635bff",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
}

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px",
  fontSize: "12px",
  color: "#8898aa",
}

const td: React.CSSProperties = {
  padding: "10px",
  borderTop: "1px solid #eee",
}

const empty: React.CSSProperties = {
  padding: "20px",
  textAlign: "center",
}

const link: React.CSSProperties = {
  color: "#635bff",
  textDecoration: "none",
}
