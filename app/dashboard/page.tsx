"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { DateTime } from "luxon"

export default function Dashboard() {
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [billingLoading, setBillingLoading] = useState(false)
  const [plan, setPlan] = useState<string>("basic")
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [urlCount30d, setUrlCount30d] = useState(0)

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

      // Fetch user plan
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", data.user.id)
        .maybeSingle()
      setPlan(profile?.plan || "basic")

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

    // Count URLs created in last 30 days for limit display
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { count } = await supabase
      .from("urls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUser.id)
      .gte("created_at", thirtyDaysAgo.toISOString())
    setUrlCount30d(count ?? 0)
  }

  async function handleManageBilling() {
    setBillingLoading(true)
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: user?.id }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert("Failed to open billing portal")
      }
    } catch (err: any) {
      console.error("Error:", err)
      alert("Error opening billing portal: " + err.message)
    } finally {
      setBillingLoading(false)
    }
  }

  async function handleUpgrade() {
    setUpgradeLoading(true)
    try {
      const response = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert("Failed to start upgrade: " + (data.error || "Unknown error"))
      }
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setUpgradeLoading(false)
    }
  }

  // ✅ FIXED ADD URL (AUTO TRIGGER WORKER)
  async function addUrl() {
    if (!user) return
    if (!url.trim()) return alert("Enter a URL")

    try {
      console.log("🚀 Adding new URL:", url)

      const albertaTime = new Date().toLocaleString("en-CA", {
        timeZone: "America/Edmonton",
      })
      console.log("Current Alberta time:", albertaTime)

      let nextCaptureISO

      if (schedule === "custom" && customDate) {
        const [year, month, day] = customDate.split("-").map(Number)
        const albertaDate = new Date(
          new Date(year, month - 1, day).toLocaleString("en-US", {
            timeZone: "America/Edmonton",
          })
        )
        albertaDate.setHours(9, 0, 0, 0)
        nextCaptureISO = new Date(
          albertaDate.toLocaleString("en-US", { timeZone: "UTC" })
        ).toISOString()
      } else {
        const now = new Date()
        const albertaNow = new Date(
          now.toLocaleString("en-US", { timeZone: "America/Edmonton" })
        )

        const nextCapture = new Date(albertaNow)

        let daysToAdd = 7
        if (schedule === "biweekly") daysToAdd = 14
        if (schedule === "29days") daysToAdd = 29
        if (schedule === "30days") daysToAdd = 30

        nextCapture.setDate(nextCapture.getDate() + daysToAdd)
        nextCapture.setHours(9, 0, 0, 0)

        nextCaptureISO = new Date(
          nextCapture.toLocaleString("en-US", { timeZone: "UTC" })
        ).toISOString()
      }

      console.log("📅 Next capture scheduled for:", nextCaptureISO)

      // Insert URL via server-side API (enforces plan limits)
      const addResponse = await fetch("/api/add-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          url: url.trim(),
          schedule_type: schedule,
          schedule_value: schedule === "custom" ? customDate : null,
          next_capture_at: nextCaptureISO,
        }),
      })

      if (!addResponse.ok) {
        const errData = await addResponse.json()
        if (errData.limitReached) {
          const isBasicPlan = errData.plan !== "pro"
          const upgradePrompt = isBasicPlan
            ? "\n\nWould you like to upgrade to Pro for up to 50 URLs/30 days?"
            : ""
          const shouldUpgrade = isBasicPlan && window.confirm(errData.error + upgradePrompt)
          if (shouldUpgrade) handleUpgrade()
          else if (!isBasicPlan) alert(errData.error)
        } else {
          alert("Failed to add URL: " + errData.error)
        }
        return
      }

      const { url: newUrl } = await addResponse.json()
      const newUrlId = newUrl?.id
      console.log("✅ URL added with ID:", newUrlId)

      // Trigger workflow to capture new URLs
      try {
        console.log("📤 Triggering capture workflow...")
        const response = await fetch("/api/capture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        })

        const responseText = await response.text()
        console.log("📬 API response status:", response.status)
        console.log("📬 API response body:", responseText)

        if (!response.ok) {
          console.error("❌ API error:", response.status, responseText)
          alert(`Workflow trigger failed: ${response.status}`)
          return
        }

        console.log("✅ Workflow triggered successfully")
        alert("✅ URL added and queued for immediate capture!")
      } catch (err: any) {
        console.error("❌ Fetch error:", err.message)
        alert("Failed to trigger workflow: " + err.message)
        return
      }

      // Clear form and refresh
      setUrl("")
      setCustomDate("")
      await fetchData(user)
    } catch (err: any) {
      console.error("❌ Unexpected error:", err)
      alert("Error: " + err.message)
    }
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
      display: "inline-block" as const,
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

  const filteredCaptures = captures.filter((c) => {
    const urlData = getUrlById(c.url_id)
    return urlData?.url?.toLowerCase().includes(search.toLowerCase())
  })

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff" }}>
      {/* TOP BAR */}
      <div style={topBar}>
        <img src="/screenly-logo.png" style={{ width: 140 }} />

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 14, color: "#555" }}>{user?.email}</div>
          {plan !== "pro" && (
            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              style={upgradeLoading ? { ...buttonUpgrade, opacity: 0.7 } : buttonUpgrade}
            >
              {upgradeLoading ? "Loading..." : "⚡ Upgrade to Pro"}
            </button>
          )}
          <button 
            onClick={handleManageBilling} 
            disabled={billingLoading} 
            style={billingLoading ? { ...buttonSecondary, opacity: 0.7 } : buttonSecondary}
          >
            {billingLoading ? "Loading..." : "Manage Billing"}
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

          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            {plan === "pro"
              ? `Pro plan · ${urlCount30d}/50 URLs added in last 30 days`
              : `Basic plan · ${urlCount30d}/15 URLs added in last 30 days`}
            {plan !== "pro" && urlCount30d >= BASIC_PLAN_WARNING_THRESHOLD && (
              <span style={{ color: "#DC2626", marginLeft: 8 }}>
                Approaching limit —{" "}
                <button
                  onClick={handleUpgrade}
                  style={{ background: "none", border: "none", color: "#7C3AED", cursor: "pointer", fontWeight: 600, padding: 0 }}
                >
                  Upgrade to Pro
                </button>
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/job-posting"
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

          <div style={headerRow}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Schedule</div>
            <div style={{ flex: 1 }}>Next</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>Added</div>
          </div>

          {filteredUrls.map((u) => (
            <div key={u.id} style={rowCard}>
              <div style={urlCell}>{u.url}</div>
              <div style={{ flex: 1 }}>{u.schedule_type}</div>
              <div style={{ flex: 1 }}>{formatAlbertaTime(u.next_capture_at)}</div>
              <div style={{ flex: 1 }}>
                <StatusBadge status={u.status} />
              </div>
              <div style={{ flex: 1 }}>{formatAlbertaTime(u.created_at)}</div>
            </div>
          ))}
        </div>

        {/* CAPTURE HISTORY */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Capture History</h3>

          <div style={headerRow}>
            <div style={{ flex: 3 }}>URL</div>
            <div style={{ flex: 1 }}>Captured</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ flex: 1 }}>PDF</div>
          </div>

          {filteredCaptures.map((c) => {
            const urlData = getUrlById(c.url_id)

            const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

            console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)
            console.log("FINAL URL:", publicUrl)

            return (
              <div key={c.id} style={rowCard}>
                <div style={urlCell}>{urlData?.url}</div>
                <div style={{ flex: 1 }}>{formatAlbertaTime(c.created_at)}</div>
                <div style={{ flex: 1 }}>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ flex: 1 }}>
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
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

const topBar = {
  display: "flex" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  padding: "20px 40px",
  borderBottom: "1px solid #eee",
}

const title = {
  fontSize: 26,
  marginBottom: 24,
  fontWeight: 700,
}

const urlCell: React.CSSProperties = {
  flex: 3,
  wordBreak: "break-all",
  whiteSpace: "normal",
  lineHeight: "1.4",
  fontSize: 13,
  color: "#333",
}

const cardStyle = {
  background: "#fff",
  padding: 24,
  borderRadius: 14,
  border: "1px solid #eee",
  marginTop: 20,
}

const sectionTitle = {
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 12,
}

const rowCard = {
  display: "flex" as const,
  padding: "14px 16px",
  marginTop: 8,
  background: "#fff",
  borderRadius: 10,
  border: "1px solid #f1f1f1",
  gap: 12,
}

const headerRow = {
  display: "flex" as const,
  padding: "8px 14px",
  marginTop: 10,
  color: "#6B7280",
  fontWeight: 600,
  fontSize: 12,
}

const inputStyle = {
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ddd",
  background: "#fff",
}

const searchStyle = {
  width: "100%",
  padding: "10px",
  marginTop: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
}

const buttonPrimary = {
  background: "#7C3AED",
  color: "#fff",
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
}

const buttonSecondary = {
  background: "#6366f1",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 13,
}

const buttonDanger = {
  background: "#ef4444",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: 13,
}

const buttonUpgrade = {
  background: "#059669",
  color: "#fff",
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
}

const BASIC_PLAN_WARNING_THRESHOLD = 12

const linkStyle = {
  color: "#7C3AED",
  fontWeight: 500,
}