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

  function Status({ status }: any) {
    const base = {
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
    }

    if (status === "completed")
      return <span style={{ ...base, background: "#EEF2FF", color: "#4F46E5" }}>Completed</span>

    if (status === "active")
      return <span style={{ ...base, background: "#ECFDF5", color: "#059669" }}>Active</span>

    return <span style={{ ...base, background: "#FEF2F2", color: "#DC2626" }}>Failed</span>
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  // 🔥 FILTER BOTH DATASETS
  const filteredUrls = urls.filter((u) =>
    u.url.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCaptures = captures.filter((c) => {
    const urlData = getUrlById(c.url_id)
    return urlData?.url.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div style={{ background: "#FAFAFA", minHeight: "100vh" }}>

      {/* TOP BAR */}
      <div style={topBar}>
        <img src="/screenly-logo.png" style={{ width: 110 }} />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>{user.email}</span>
          <button onClick={handleLogout} style={logoutBtn}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}>

        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={card}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL..."
              style={{ ...input, flex: 2 }}
            />

            <select value={schedule} onChange={(e) => setSchedule(e.target.value)} style={input}>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="custom">Specific date</option>
            </select>

            {schedule === "custom" && (
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} style={input} />
            )}

            <button onClick={addUrl} style={addBtn}>Add</button>
          </div>
        </div>

        {/* SEARCH */}
        <input
          placeholder="Search all URLs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        {/* TRACKED URLS */}
        <div style={tableCard}>
          <h3 style={sectionTitle}>Tracked URLs</h3>

          <div style={tableHeader}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Schedule</div>
            <div style={{ flex: 1 }}>Next</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>Added</div>
          </div>

          {filteredUrls.map((u) => (
            <div key={u.id} style={row}>
              <div style={{ flex: 3 }}>{u.url}</div>
              <div style={{ flex: 1 }}>{u.schedule_type}</div>
              <div style={{ flex: 1 }}>{formatTime(u.next_capture_at)}</div>
              <div style={{ flex: 1 }}><Status status={u.status} /></div>
              <div style={{ flex: 1 }}>{formatTime(u.created_at)}</div>
            </div>
          ))}
        </div>

        {/* CAPTURE HISTORY */}
        <div style={tableCard}>
          <h3 style={sectionTitle}>Capture History</h3>

          <div style={tableHeader}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Captured</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>PDF</div>
          </div>

          {filteredCaptures.map((c) => {
            const urlData = getUrlById(c.url_id)
            const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

            return (
              <div key={c.id} style={row}>
                <div style={{ flex: 3 }}>{urlData?.url}</div>
                <div style={{ flex: 1 }}>{formatTime(c.created_at)}</div>
                <div style={{ flex: 1 }}><Status status={c.status} /></div>
                <div style={{ flex: 1 }}>
                  <a href={publicUrl} target="_blank">Download</a>
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

/* STYLES SAME AS BEFORE */
