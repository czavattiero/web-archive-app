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
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)

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
        .select("plan, subscribed, trial_ends_at")
        .eq("id", data.user.id)
        .maybeSingle()
      setPlan(profile?.plan || "basic")
      setTrialEndsAt(profile?.trial_ends_at || null)

      const isTrial = (profile?.plan === "trial" || !profile?.plan) && !profile?.subscribed
      const trialExpired = profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date()

      if (isTrial && trialExpired) {
        router.replace("/choose-plan")
        return
      }

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

    // Count URLs created in last 30 days for limit display — exclude URLs with only failed captures
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data: recentUrls } = await supabase
      .from("urls")
      .select("id")
      .eq("user_id", currentUser.id)
      .gte("created_at", thirtyDaysAgo.toISOString())

    const recentUrlIds = (recentUrls || []).map((u: any) => u.id)
    let urlCount = recentUrlIds.length

    if (recentUrlIds.length > 0) {
      const { data: successCaptures } = await supabase
        .from("captures")
        .select("url_id")
        .in("url_id", recentUrlIds)
        .eq("status", "success")

      const successfulUrlIds = new Set((successCaptures || []).map((c: any) => c.url_id))

      const { data: failedCaptures } = await supabase
        .from("captures")
        .select("url_id")
        .in("url_id", recentUrlIds)
        .eq("status", "failed")

      const failedUrlIds = new Set((failedCaptures || []).map((c: any) => c.url_id))

      urlCount = recentUrlIds.filter((id: string) => {
        const hasSuccess = successfulUrlIds.has(id)
        const hasFailed = failedUrlIds.has(id)
        const isPending = !hasSuccess && !hasFailed
        return hasSuccess || isPending
      }).length
    }

    setUrlCount30d(urlCount)
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
        if (errData.trialExpired) {
          router.push("/choose-plan")
          return
        } else if (errData.limitReached) {
          const isBasicPlan = errData.plan !== "pro"
          const upgradePrompt = isBasicPlan
            ? "\n\nWould you like to upgrade to Pro for up to 40 URLs/30 days?"
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

  function StatusBadge({ status, retryCount = 0, urlId }: { status: string; retryCount?: number; urlId?: string }) {
    const base = {
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      display: "inline-block" as const,
    }

    if (status === "active" && urlId) {
      const urlCaptures = captures.filter((c) => c.url_id === urlId)
      const hasSuccess = urlCaptures.some((c) => c.status === "success")
      const hasFailed = urlCaptures.some((c) => c.status === "failed")

      if (!hasSuccess && hasFailed)
        return <span style={{ ...base, background: "#FEE2E2", color: "#B91C1C" }}>Capture Failed</span>
    }

    if (status === "active" && retryCount > 0)
      return <span style={{ ...base, background: "#FEF3C7", color: "#B45309" }}>Retrying</span>

    if (status === "active")
      return <span style={{ ...base, background: "#DCFCE7", color: "#15803D" }}>Active</span>

    if (status === "completed")
      return <span style={{ ...base, background: "#EEF2FF", color: "#4338CA" }}>Completed</span>

    if (status === "failed")
      return <span style={{ ...base, background: "#FEE2E2", color: "#B91C1C" }}>Failed</span>

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
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* TOP BAR */}
      <div style={topBar}>
        <img src="/screenly-logo.png" alt="Screenly logo" style={{ height: 48 }} />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#6B7280" }}>{user?.email}</div>
          {plan !== "pro" && (
            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              style={upgradeLoading ? { ...buttonUpgrade, opacity: 0.7 } : buttonUpgrade}
            >
              {upgradeLoading ? "Loading..." : plan === "trial" ? "⚡ Choose a Plan" : "⚡ Upgrade to Pro"}
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

      {plan === "trial" && trialEndsAt && new Date(trialEndsAt) > new Date() && (() => {
        const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return (
          <div style={{
            background: daysLeft <= 3 ? "#FEF3C7" : "#EEF2FF",
            borderBottom: `1px solid ${daysLeft <= 3 ? "#FCD34D" : "#C7D2FE"}`,
            padding: "12px 40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
          }}>
            <span style={{ color: daysLeft <= 3 ? "#92400E" : "#3730A3", fontWeight: 500 }}>
              {daysLeft <= 1
                ? "⚠️ Your free trial expires today!"
                : `⏳ Free trial: ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`}
            </span>
            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              style={{
                background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
                color: "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {upgradeLoading ? "Loading..." : "Choose a Plan"}
            </button>
          </div>
        )
      })()}

      <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Add URL</h3>

          <div style={{
            display: "inline-flex",
            alignItems: "center",
            background: "#F3F4F6",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 12,
            color: "#6B7280",
            fontWeight: 500,
            marginBottom: 16,
          }}>
            {plan === "pro"
              ? `Professional plan · ${urlCount30d}/40 URLs in last 30 days`
              : plan === "trial"
              ? `Free trial · ${urlCount30d}/15 URLs in last 30 days`
              : `Basic plan · ${urlCount30d}/15 URLs in last 30 days`}
            {plan !== "pro" && urlCount30d >= BASIC_PLAN_WARNING_THRESHOLD && (
              <span style={{ color: "#DC2626", marginLeft: 8 }}>
                Approaching limit —{" "}
                <button
                  onClick={handleUpgrade}
                  style={{ background: "none", border: "none", color: "#6A11CB", cursor: "pointer", fontWeight: 600, padding: 0 }}
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
                <StatusBadge status={u.status} retryCount={u.retry_count ?? 0} urlId={u.id} />
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
  padding: "14px 40px",
  background: "#ffffff",
  borderBottom: "1px solid #E5E7EB",
  position: "sticky" as const,
  top: 0,
  zIndex: 10,
}

const title = {
  fontSize: 28,
  marginBottom: 24,
  fontWeight: 700,
  color: "#111827",
}

const urlCell: React.CSSProperties = {
  flex: 3,
  wordBreak: "break-all",
  whiteSpace: "normal",
  lineHeight: "1.5",
  fontSize: 13,
  color: "#111827",
  fontWeight: 500,
}

const cardStyle = {
  background: "#ffffff",
  padding: "24px 28px",
  borderRadius: 16,
  border: "1px solid #E5E7EB",
  marginTop: 20,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
}

const sectionTitle = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 12,
  color: "#111827",
}

const rowCard = {
  display: "flex" as const,
  padding: "14px 16px",
  alignItems: "center" as const,
  gap: 12,
  borderBottom: "1px solid #F9FAFB",
  fontSize: 14,
  color: "#374151",
}

const headerRow = {
  display: "flex" as const,
  padding: "8px 16px",
  marginTop: 4,
  color: "#6B7280",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  borderBottom: "1px solid #F3F4F6",
}

const inputStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  background: "#F9FAFB",
  fontSize: 14,
  color: "#111827",
  outline: "none",
}

const searchStyle = {
  width: "100%",
  padding: "10px 14px",
  marginBottom: 16,
  borderRadius: 8,
  border: "1.5px solid #E5E7EB",
  background: "#F9FAFB",
  fontSize: 14,
  color: "#111827",
  boxSizing: "border-box" as const,
}

const buttonPrimary = {
  background: "#6A11CB",
  color: "#fff",
  padding: "10px 22px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
}

const buttonSecondary = {
  background: "#ffffff",
  color: "#6A11CB",
  padding: "9px 18px",
  borderRadius: 8,
  border: "1.5px solid #6A11CB",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
}

const buttonDanger = {
  background: "#F3F4F6",
  color: "#374151",
  padding: "9px 18px",
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
}

const buttonUpgrade = {
  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
  color: "#fff",
  padding: "9px 18px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: "0.2px",
}

const BASIC_PLAN_WARNING_THRESHOLD = 12

const linkStyle = {
  color: "#6A11CB",
  fontWeight: 600,
  fontSize: 13,
  textDecoration: "none",
}