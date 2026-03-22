"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const [url, setUrl] = useState("")
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push("/login")
        return
      }

      setUser(data.user)
      setLoadingUser(false)
      fetchData()
    }

    loadUser()
  }, [])

  async function fetchData() {
    const { data: urlsData } = await supabase.from("urls").select("*")

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!user) return

    const { error } = await supabase.from("urls").insert([
      {
        url,
        user_id: user.id,
        next_capture_at: new Date().toISOString(),
        schedule_type: "weekly",
      },
    ])

    if (error) {
      console.error(error)
      return
    }

    setUrl("")
    fetchData()
  }

  if (loadingUser) {
    return <div style={{ padding: 40 }}>Loading...</div>
  }

  return (
    <div style={layout}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <h2 style={logo}>WebArchive</h2>
        <div style={menuActive}>Dashboard</div>
        <div style={menu}>URLs</div>
        <div style={menu}>Captures</div>
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

            <button onClick={addUrl} style={button}>
              Add URL
            </button>
          </div>
        </div>

        {/* URL TABLE */}
        <div style={card}>
          <h3 style={cardTitle}>Tracked URLs</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>User</th>
              </tr>
            </thead>

            <tbody>
              {urls.length === 0 ? (
                <tr>
                  <td colSpan={2} style={empty}>
                    No URLs yet
                  </td>
                </tr>
              ) : (
                urls.map((u) => (
                  <tr key={u.id}>
                    <td style={td}>{u.url}</td>
                    <td style={tdSmall}>{u.user_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* CAPTURE TABLE */}
        <div style={card}>
          <h3 style={cardTitle}>Capture History</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>File</th>
                <th style={th}>Status</th>
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
                  const filePath = c.file_path

                  if (!filePath) {
                    return (
                      <tr key={c.id}>
                        <td style={td}>—</td>
                        <td style={td}>
                          <span style={badgeError}>Failed</span>
                        </td>
                        <td style={tdSmall}>{c.error}</td>
                      </tr>
                    )
                  }

                  const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${filePath}`

                  return (
                    <tr key={c.id}>
                      <td style={td}>{filePath}</td>
                      <td style={td}>
                        <span style={badgeSuccess}>Success</span>
                      </td>
                      <td style={td}>
                        <a href={publicUrl} target="_blank" style={link}>
                          View
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

/* 🎨 STYLES */

const layout = {
  display: "flex",
  background: "#f6f9fc",
  minHeight: "100vh",
  fontFamily: "Inter, sans-serif",
}

const sidebar = {
  width: "220px",
  background: "#0a2540",
  color: "#fff",
  padding: "20px",
}

const logo = { marginBottom: "30px" }

const menu = { padding: "10px 0", opacity: 0.7 }
const menuActive = { padding: "10px 0", fontWeight: "bold" }

const main = { flex: 1, padding: "30px" }

const title = { fontSize: "24px", marginBottom: "20px" }

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "10px",
  marginBottom: "20px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
}

const cardTitle = { marginBottom: "10px" }

const row = { display: "flex", gap: "10px" }

const input = {
  flex: 1,
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ddd",
}

const button = {
  background: "#635bff",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
}

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
}

const th = {
  textAlign: "left" as const,
  padding: "10px",
  fontSize: "12px",
  color: "#8898aa",
}

const td = {
  padding: "10px",
  borderTop: "1px solid #eee",
}

const tdSmall = {
  padding: "10px",
  fontSize: "12px",
  color: "#999",
}

const empty = {
  padding: "20px",
  textAlign: "center" as const,
}

const badgeSuccess = {
  background: "#e6fffa",
  padding: "4px 8px",
  borderRadius: "6px",
}

const badgeError = {
  background: "#fff1f0",
  padding: "4px 8px",
  borderRadius: "6px",
}

const link = {
  color: "#635bff",
  textDecoration: "none",
}
