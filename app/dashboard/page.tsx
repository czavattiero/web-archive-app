"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"
import { DateTime } from "luxon"
import DisclaimerBanner from "../components/DisclaimerBanner"
import DisclaimerModal from "../components/DisclaimerModal"
import { LABEL_MAX_LENGTH } from "../../lib/labelUtils"

const MAX_SUBSCRIPTION_RETRIES = 8
const RETRY_DELAY_MS = 1000
const SHORT_SUBSCRIPTION_RETRIES = 3
const SHORT_RETRY_DELAY_MS = 500
const DASHBOARD_INIT_TIMEOUT_MS = 30000
const MAX_AUTO_RETRIES = 3
const VERIFY_REQUEST_TIMEOUT_MS = 8000
const ACCESS_TOKEN_COOKIE = "sb-access-token"

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [paymentProcessing, setPaymentProcessing] = useState(false)
  const [autoRetryCount, setAutoRetryCount] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [billingLoading, setBillingLoading] = useState(false)
  const [plan, setPlan] = useState<string>("basic")
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [urlCount30d, setUrlCount30d] = useState(0)
  const [quotaResetDays, setQuotaResetDays] = useState<number | null>(null)
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)

  const [url, setUrl] = useState("")
  const [urlLabel, setUrlLabel] = useState("")
  const [schedule, setSchedule] = useState("weekly")
  const [customDate, setCustomDate] = useState("")

  const [isSubUser, setIsSubUser] = useState(false)
  const isSubUserRef = useRef(isSubUser)
  const [subUsers, setSubUsers] = useState<any[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [deletingSubUserId, setDeletingSubUserId] = useState<string | null>(null)
  const [deletingUrlId, setDeletingUrlId] = useState<string | null>(null)

  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [showAddButtonHint, setShowAddButtonHint] = useState(false)
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(true)
  const [urlsOpen, setUrlsOpen] = useState(true)
  const [capturesOpen, setCapturesOpen] = useState(true)

  async function getAccessToken() {
    const { data: sessionData } = await supabase.auth.getSession()
    return sessionData.session?.access_token ?? null
  }

  function getCookieAttributes(maxAgeSeconds: number) {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : ""
    return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`
  }

  function persistAccessTokenCookie(token: string | null) {
    if (!token) return
    document.cookie = `${ACCESS_TOKEN_COOKIE}=${encodeURIComponent(token)}; ${getCookieAttributes(3600)}`
  }

  async function getAuthorizedHeaders(contentTypeJson = true) {
    const token = await getAccessToken()
    if (!token) {
      throw new Error("Session expired. Please log in again.")
    }
    persistAccessTokenCookie(token)
    return {
      ...(contentTypeJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    }
  }

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const fromPayment = searchParams.get("fromPayment") === "true"
    const sessionId = searchParams.get("session_id")

    async function init() {
      try {
        const { data } = await supabase.auth.getUser()
        if (cancelled) return

        if (!data.user) {
          if (cancelled) return
          router.replace("/login")
          return
        }

        // Guard: if the user accepted an invite but has not yet set their
        // password, send them to /set-password before allowing dashboard access.
        // This prevents the onboarding step from being skipped by navigating
        // directly to /dashboard after clicking the invite link.
        if (data.user.user_metadata?.needs_password_setup) {
          if (cancelled) return
          router.replace("/set-password")
          return
        }

        if (cancelled) return
        setUser(data.user)

        const currentToken = await getAccessToken()
        persistAccessTokenCookie(currentToken)

        // Fetch user plan (include parent_user_id to detect sub-users)
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscribed, trial_ends_at, parent_user_id, stripe_customer_id")
          .eq("id", data.user.id)
          .maybeSingle()
        if (cancelled) return

        // If this user was invited as a sub-user and hasn't been linked yet,
        // link now (user_metadata.parent_user_id is set by the invite API)
        const metaParentId = data.user.user_metadata?.parent_user_id
        let parentUserId: string | null = profile?.parent_user_id || null

        if (metaParentId && !parentUserId) {
          // Treat the user as a sub-user immediately based on metadata,
          // regardless of whether the link API call succeeds.
          parentUserId = metaParentId
          try {
            await fetch("/api/sub-users/link", {
              method: "POST",
              headers: await getAuthorizedHeaders(true),
              body: JSON.stringify({ userId: data.user.id, parentUserId: metaParentId }),
            })
            if (cancelled) return
          } catch (error) {
            if (cancelled) return
            // best-effort — isSubUser is already set correctly
            console.error("Failed to persist sub-user link:", error)
          }
        }

        if (cancelled) return
        const isSubUserAccount = !!parentUserId
        isSubUserRef.current = isSubUserAccount
        setIsSubUser(isSubUserAccount)

        setPlan(profile?.plan || "basic")
        setTrialEndsAt(profile?.trial_ends_at || null)

        // Sub-users are governed by their parent's billing — skip all billing redirects
        if (!isSubUserAccount) {
          // Subscribed users are valid paid users even if plan is stale (e.g., still "trial")
          if (profile?.subscribed) {
            setLoading(false)
            fetchData(data.user)
            return
          }

          const isTrial = (profile?.plan === "trial" || !profile?.plan) && !profile?.subscribed
          const trialExpired = profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date()

          if (fromPayment) {
            let subscribed = false

            // Call verify-session first to trigger the DB update when needed.
            if (sessionId) {
              const verifiedKey = `verified_session_${sessionId}`
              const alreadyVerified = sessionStorage.getItem(verifiedKey) === "true"

              if (!alreadyVerified) {
                const controller = new AbortController()
                const abortTimeoutId = setTimeout(() => controller.abort(), VERIFY_REQUEST_TIMEOUT_MS)
                try {
                  const res = await fetch("/api/verify-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_id: sessionId }),
                    signal: controller.signal,
                  })
                  if (cancelled) return
                  if (res.ok) {
                    const result = await res.json()
                    if (cancelled) return
                    if (result.success) {
                      subscribed = true
                      sessionStorage.setItem(verifiedKey, "true")
                    }
                  }
                } catch (error) {
                  if (cancelled) return
                  console.error("verify-session call failed on dashboard:", error)
                } finally {
                  clearTimeout(abortTimeoutId)
                }
              } else {
                subscribed = true
              }
            }

            // Retry polling for up to 8s to handle DB propagation lag.
            if (!subscribed) {
              for (let i = 0; i < MAX_SUBSCRIPTION_RETRIES; i++) {
                await new Promise((res) => setTimeout(res, RETRY_DELAY_MS))
                if (cancelled) return
                const { data: retryProfile } = await supabase
                  .from("profiles")
                  .select("subscribed")
                  .eq("id", data.user.id)
                  .maybeSingle()
                if (cancelled) return
                if (retryProfile?.subscribed) {
                  subscribed = true
                  break
                }
              }
            }

            if (!subscribed) {
              if (cancelled) return
              setPaymentProcessing(true)
              return
            }
            // subscribed is now confirmed — continue to load the dashboard
          } else {
            // Not coming from the payment success page — apply standard billing gates.

            // Expired trial owners must choose a plan
            if (isTrial && trialExpired) {
              router.replace("/choose-plan")
              return
            }

            // basic/pro owners who haven't completed payment cannot use the dashboard
            const isPaidPlan = profile?.plan === "basic" || profile?.plan === "pro"
            if (isPaidPlan && !profile?.subscribed) {
              // If the user has a stripe_customer_id they have previously paid — their
              // subscribed field may simply be stale (DB propagation lag or a failed
              // verify-session call). Run a brief retry before giving up.
              let retrySubscribed = false
              if (profile?.stripe_customer_id) {
                for (let i = 0; i < SHORT_SUBSCRIPTION_RETRIES; i++) {
                  await new Promise((res) => setTimeout(res, SHORT_RETRY_DELAY_MS))
                  if (cancelled) return
                  const { data: retryProfile } = await supabase
                    .from("profiles")
                    .select("subscribed")
                    .eq("id", data.user.id)
                    .maybeSingle()
                  if (cancelled) return
                  if (retryProfile?.subscribed) {
                    retrySubscribed = true
                    break
                  }
                }
              }

              if (!retrySubscribed) {
                router.replace("/choose-plan")
                return
              }
              // subscribed confirmed on retry — continue to load the dashboard
            }
          }
        }

        if (cancelled) return
        setLoading(false)
        fetchData(data.user)
      } catch (err) {
        if (cancelled) return
        console.error("Dashboard init error:", err)
        setLoading(false)
      }
    }

    async function initWithTimeout() {
      const timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(
          () => {
            if (cancelled) return
            reject(new Error("Dashboard init timed out after 30 seconds"))
          },
          DASHBOARD_INIT_TIMEOUT_MS
        )
      })

      try {
        await Promise.race([init(), timeoutPromise])
      } catch (err) {
        if (cancelled) return
        console.error("Dashboard init error or timeout:", err)
        setLoading(false)
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }
    }

    initWithTimeout()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [router, retryCount, searchParams])

  useEffect(() => {
    if (!paymentProcessing) return
    if (autoRetryCount >= MAX_AUTO_RETRIES) return
    const retryInterval = setInterval(() => {
      clearInterval(retryInterval)
      setPaymentProcessing(false)
      setAutoRetryCount((c) => c + 1)
      setRetryCount((c) => c + 1)
    }, 3000)
    return () => clearInterval(retryInterval)
  }, [paymentProcessing, autoRetryCount])

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

    // Fetch sub-users for parent accounts only
    if (!isSubUserRef.current) {
      const subUsersRes = await fetch(`/api/sub-users?userId=${currentUser.id}`, {
        headers: await getAuthorizedHeaders(false),
      })
      if (subUsersRes.ok) {
        const { subUsers: fetchedSubUsers } = await subUsersRes.json()
        setSubUsers(fetchedSubUsers || [])
      }
    }

    // Fetch aggregated URL count (owner + sub-users) from server-side API
    try {
      const countRes = await fetch(`/api/account-url-count?userId=${currentUser.id}`, {
        headers: await getAuthorizedHeaders(false),
      })
      if (countRes.ok) {
        const { urlCount, quotaResetAt } = await countRes.json()
        setUrlCount30d(urlCount ?? 0)
        if (quotaResetAt) {
          const msLeft = new Date(quotaResetAt).getTime() - Date.now()
          setQuotaResetDays(Math.max(1, Math.floor(msLeft / (1000 * 60 * 60 * 24))))
        } else {
          setQuotaResetDays(null)
        }
      } else {
        setUrlCount30d(0)
        setQuotaResetDays(null)
      }
    } catch (err) {
      console.error("Failed to fetch account URL count:", err)
      setUrlCount30d(0)
      setQuotaResetDays(null)
    }
  }

  async function handleManageBilling() {
    setBillingLoading(true)
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: await getAuthorizedHeaders(true),
        body: JSON.stringify({ userId: user?.id }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else if (data.error === "No Stripe customer") {
        alert("Could not find your billing account. Please contact support.")
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
        headers: await getAuthorizedHeaders(true),
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
        headers: await getAuthorizedHeaders(true),
        body: JSON.stringify({
          userId: user.id,
          url: url.trim(),
          label: urlLabel.trim() || null,
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
          headers: await getAuthorizedHeaders(true),
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
      setUrlLabel("")
      setCustomDate("")
      await fetchData(user)
    } catch (err: any) {
      console.error("❌ Unexpected error:", err)
      alert("Error: " + err.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = `${ACCESS_TOKEN_COOKIE}=; ${getCookieAttributes(0)}`
    // Preserve disclaimer acknowledgement flags so the modal doesn't re-appear on next login
    const disclaimerEntries = Object.keys(localStorage)
      .filter((key) => key.startsWith("disclaimer_acknowledged_"))
      .map((key): [string, string] => [key, localStorage.getItem(key) as string])
    localStorage.clear()
    disclaimerEntries.forEach(([key, value]) => localStorage.setItem(key, value))
    window.location.href = "/"
  }

  async function handleInviteSubUser() {
    const trimmed = inviteEmail.trim()
    if (!trimmed) return alert("Enter an email address")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return alert("Please enter a valid email address")
    setInviteLoading(true)
    try {
      const inviteHeaders = await getAuthorizedHeaders(true)
      const res = await fetch("/api/sub-users/invite", {
        method: "POST",
        headers: inviteHeaders,
        body: JSON.stringify({ parentUserId: user?.id, email: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert("Invite failed: " + data.error)
      } else {
        alert(`✅ Invitation sent to ${trimmed}`)
        setInviteEmail("")
        await fetchData(user)
      }
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setInviteLoading(false)
    }
  }

  async function handleDeleteSubUser(subUser: any) {
    if (!user?.id) return
    const confirmDelete = window.confirm(
      `Delete sub-user ${subUser.email}?\n\nThis will permanently remove their account, scheduled URLs, and captures.`
    )
    if (!confirmDelete) return

    setDeletingSubUserId(subUser.id)
    try {
      const deleteHeaders = await getAuthorizedHeaders(true)
      const res = await fetch("/api/sub-users", {
        method: "DELETE",
        headers: deleteHeaders,
        body: JSON.stringify({ parentUserId: user.id, subUserId: subUser.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert("Delete failed: " + (data.error || "Unknown error"))
      } else {
        await fetchData(user)
      }
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setDeletingSubUserId(null)
    }
  }

  async function handleDeleteUrl(urlItem: any) {
    if (!user?.id) return
    const confirmDelete = window.confirm(
      `Delete URL ${urlItem.url}?\n\nThis removes it from your dashboard and stops future captures. It does not restore quota for this billing period.`
    )
    if (!confirmDelete) return

    setDeletingUrlId(urlItem.id)
    try {
      const deleteHeaders = await getAuthorizedHeaders(true)
      const res = await fetch("/api/delete-url", {
        method: "DELETE",
        headers: deleteHeaders,
        body: JSON.stringify({ urlId: urlItem.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert("Delete failed: " + (data.error || "Unknown error"))
      } else {
        await fetchData(user)
      }
    } catch (err: any) {
      alert("Error: " + err.message)
    } finally {
      setDeletingUrlId(null)
    }
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
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      display: "inline-block" as const,
    }

    if (status === "active")
      return <span style={{ ...base, background: "#DCFCE7", color: "#15803D" }}>Active</span>

    if (status === "completed")
      return <span style={{ ...base, background: "#EEF2FF", color: "#4338CA" }}>Completed</span>

    if (status === "failed")
      return <span style={{ ...base, background: "#FEE2E2", color: "#B91C1C" }}>Failed</span>

    return <span style={{ ...base, background: "#E5E7EB", color: "#374151" }}>{status}</span>
  }

  const filteredUrls = urls.filter((u) => {
    if (u.status === "deleted") return false
    const q = search.toLowerCase()
    return u.url.toLowerCase().includes(q) || (u.label || "").toLowerCase().includes(q)
  })

  const filteredCaptures = captures.filter((c) => {
    const q = search.toLowerCase()
    const urlData = getUrlById(c.url_id)
    return (
      urlData?.url?.toLowerCase().includes(q) ||
      (c.label || "").toLowerCase().includes(q)
    )
  })

  const fromPaymentParam = searchParams.get("fromPayment") === "true"

  if (paymentProcessing) {
    const maxRetriesReached = autoRetryCount >= MAX_AUTO_RETRIES
    return (
      <div style={paymentLoadingContainer}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{maxRetriesReached ? "❌" : "⏳"}</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
            {maxRetriesReached
              ? "Subscription confirmation is taking longer than expected"
              : "Still processing your subscription…"}
          </h2>
          <p style={{ color: "#6B7280", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
            {maxRetriesReached
              ? "Your payment was received, but we couldn\u2019t confirm your subscription automatically. Please contact support and we\u2019ll get you sorted out right away."
              : "Your payment was received! We\u2019re waiting for the confirmation to come through. This usually takes just a moment."}
          </p>
          {maxRetriesReached && (
            <div style={{ marginBottom: 20 }}>
              <a
                href="mailto:support@timedshot.ca"
                style={{ color: "#6A11CB", fontWeight: 600, fontSize: 15, textDecoration: "underline" }}
              >
                Contact Support
              </a>
            </div>
          )}
          <button
            onClick={() => {
              setAutoRetryCount(0)
              setPaymentProcessing(false)
              setRetryCount((c) => c + 1)
            }}
            style={{ background: "linear-gradient(135deg, #6A11CB, #FF7A00)", color: "#fff", border: "none", padding: "12px 28px", borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    if (fromPaymentParam) {
      return (
        <div style={paymentLoadingContainer}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Activating your subscription…</h2>
            <p style={{ color: "#6B7280", fontSize: 15, lineHeight: 1.6 }}>
              Please wait while we confirm your payment.
            </p>
          </div>
        </div>
      )
    }
    return <div style={{ padding: 40 }}>Loading...</div>
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* TOP BAR */}
      <div className="dashboard-topbar" style={topBar}>
        <img className="dashboard-logo" src="/Timedshot-logo.png" alt="Timedshot logo" style={{ height: 160 }} />

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#6B7280" }}>{user?.email}</div>
          {isSubUser && (
            <div style={{ fontSize: 12, color: "#6B7280", background: "#F3F4F6", padding: "4px 10px", borderRadius: 999 }}>
              Sub-user
            </div>
          )}
          {!isSubUser && plan !== "pro" && plan !== "enterprise" && (
            <button
              onClick={plan === "trial" ? () => router.push("/choose-plan") : handleUpgrade}
              disabled={plan !== "trial" && !!upgradeLoading}
              style={plan !== "trial" && upgradeLoading ? { ...buttonUpgrade, opacity: 0.7 } : buttonUpgrade}
            >
              {plan !== "trial" && upgradeLoading ? "Loading..." : plan === "trial" ? "⚡ Choose a Plan" : "⚡ Upgrade to Pro"}
            </button>
          )}
          {!isSubUser && plan !== "trial" && plan !== "enterprise" && (
            <button 
              onClick={handleManageBilling} 
              disabled={billingLoading} 
              style={billingLoading ? { ...buttonSecondary, opacity: 0.7 } : buttonSecondary}
            >
              {billingLoading ? "Loading..." : "Manage Billing"}
            </button>
          )}
          <button onClick={handleLogout} style={buttonDanger}>
            Sign Out
          </button>
        </div>
      </div>

      {!isSubUser && plan === "trial" && trialEndsAt && new Date(trialEndsAt) > new Date() && (() => {
        const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return (
          <div className="trial-banner" style={{
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
              onClick={() => router.push("/choose-plan")}
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
              Choose a Plan
            </button>
          </div>
        )
      })()}

      <div className="dashboard-content" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <DisclaimerBanner />
        {/* SUB-USERS — only shown to parent (non-sub) accounts */}
        {!isSubUser && (
          <div style={cardStyle}>
            <h3 style={sectionTitle}>Sub-users</h3>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
              Invite team members to add and track URLs under your account. Their URLs count against your shared plan quota.
            </p>

            {/* Invite form */}
            <div className="invite-row" style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                style={{ ...inputStyle, flex: 2 }}
              />
              <button
                onClick={handleInviteSubUser}
                disabled={inviteLoading}
                style={inviteLoading ? { ...buttonPrimary, opacity: 0.7 } : buttonPrimary}
              >
                {inviteLoading ? "Sending..." : "Send Invite"}
              </button>
            </div>

            {/* Sub-user list */}
            {subUsers.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No sub-users yet.</p>
            ) : (
              <>
                <div style={headerRow}>
                  <div style={{ flex: 3 }}>Email</div>
                  <div style={{ flex: 1 }}>Joined</div>
                  <div style={{ flex: 1, textAlign: "right" }}>Actions</div>
                </div>
                {subUsers.map((su: any) => (
                  <div key={su.id} style={rowCard}>
                    <div style={{ flex: 3, fontSize: 13, color: "#111827" }}>{su.email}</div>
                    <div style={{ flex: 1 }}>{formatAlbertaTime(su.created_at)}</div>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteSubUser(su)}
                        disabled={deletingSubUserId === su.id}
                        style={{
                          ...buttonGhostDanger,
                          ...(deletingSubUserId === su.id ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                        }}
                      >
                        {deletingSubUserId === su.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ADD URL */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Add URL</h3>

          {!isSubUser && (
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
              {plan === "enterprise"
                ? `Enterprise plan · ${urlCount30d} URLs (unlimited)`
                : plan === "pro"
                ? `Professional plan · ${urlCount30d}/40 URLs`
                : plan === "trial"
                ? `Free trial · ${urlCount30d}/15 URLs`
                : `Basic plan · ${urlCount30d}/15 URLs`}
              {quotaResetDays !== null && (
                <span style={{ color: "#9CA3AF", marginLeft: 6 }}>
                  · resets in {quotaResetDays} day{quotaResetDays !== 1 ? "s" : ""}
                </span>
              )}
              {plan !== "pro" && plan !== "enterprise" && urlCount30d >= BASIC_PLAN_WARNING_THRESHOLD && (
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
          )}

          <div className="add-url-row" style={{ display: "flex", gap: 10, flexDirection: "column" }}>
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

              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <button
                  onClick={addUrl}
                  style={buttonPrimary}
                  onMouseEnter={() => setShowAddButtonHint(true)}
                  onMouseLeave={() => setShowAddButtonHint(false)}
                  onFocus={() => setShowAddButtonHint(true)}
                  onBlur={() => setShowAddButtonHint(false)}
                  aria-describedby="add-button-tooltip"
                >
                  Add
                </button>
                <div
                  id="add-button-tooltip"
                  role="tooltip"
                  style={{
                    ...addButtonTooltipStyle,
                    opacity: showAddButtonHint ? 1 : 0,
                    visibility: showAddButtonHint ? "visible" : "hidden",
                    pointerEvents: "none",
                  }}
                >
                  Immediate first capture - just schedule the next one!
                </div>
              </div>
            </div>
            <input
              value={urlLabel}
              onChange={(e) => setUrlLabel(e.target.value.substring(0, LABEL_MAX_LENGTH))}
              placeholder="Label (optional) - Users can search by label or URL"
              style={{ ...inputStyle, fontSize: 13, color: "#6B7280" }}
              maxLength={LABEL_MAX_LENGTH}
            />
          </div>
        </div>

        {/* TRACKED URLS */}
        <div style={cardStyle}>
          <button
            onClick={() => setUrlsOpen((o) => !o)}
            style={accordionToggle}
            className="accordion-toggle"
            aria-expanded={urlsOpen}
          >
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Tracked URLs</h3>
            <span style={chevronStyle(urlsOpen)}>▾</span>
          </button>

          {urlsOpen && (
            <>
              <div style={{ position: "relative", marginTop: 12 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  style={searchStyle}
                />
                {!search && !searchFocused && (
                  <span style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    pointerEvents: "none",
                    fontSize: 14,
                  }}>
                    <span style={{ color: "#374151" }}>Search</span>
                    <span style={{ color: "#9CA3AF" }}>{" - users can search by label or URL"}</span>
                  </span>
                )}
              </div>

              <div className="table-scroll-wrapper">
                <div style={headerRow}>
                  <div style={{ flex: 3 }}>URL</div>
                  <div style={{ flex: 2 }}>Label</div>
                  <div style={{ flex: 1 }}>Schedule</div>
                  <div style={{ flex: 1 }}>Next</div>
                  <div style={{ flex: 1 }}>Status</div>
                  <div style={{ flex: 1 }}>Added</div>
                  <div style={{ flex: 1, textAlign: "right" }}>Actions</div>
                </div>

                {filteredUrls.map((u) => (
                  <div key={u.id} style={rowCard}>
                    <div style={urlCell}>
                      <div>{u.url}</div>
                    </div>
                    <div style={labelCell}>
                      {u.label && <span style={labelBadge}>{u.label}</span>}
                    </div>
                    <div style={{ flex: 1 }}>{u.schedule_type}</div>
                    <div style={{ flex: 1 }}>{formatAlbertaTime(u.next_capture_at)}</div>
                    <div style={{ flex: 1 }}>
                      <StatusBadge status={u.status} />
                    </div>
                    <div style={{ flex: 1 }}>{formatAlbertaTime(u.created_at)}</div>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <button
                        onClick={() => handleDeleteUrl(u)}
                        disabled={deletingUrlId === u.id}
                        style={{
                          ...buttonGhostDanger,
                          ...(deletingUrlId === u.id ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                        }}
                      >
                        {deletingUrlId === u.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CAPTURE HISTORY */}
        <div style={cardStyle}>
          <button
            onClick={() => setCapturesOpen((o) => !o)}
            style={accordionToggle}
            className="accordion-toggle"
            aria-expanded={capturesOpen}
          >
            <h3 style={{ ...sectionTitle, marginBottom: 0 }}>Capture History</h3>
            <span style={chevronStyle(capturesOpen)}>▾</span>
          </button>

          {capturesOpen && (
            <div className="table-scroll-wrapper" style={{ marginTop: 12 }}>
              <div style={headerRow}>
                <div style={{ flex: 3 }}>URL</div>
                <div style={{ flex: 2 }}>Label</div>
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
                    <div style={urlCell}>
                      <div>{urlData?.url}</div>
                    </div>
                    <div style={labelCell}>
                      {c.label && <span style={labelBadge}>{c.label}</span>}
                    </div>
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
          )}
        </div>

      </div>

      {showDisclaimerModal && user !== null && (
        <DisclaimerModal userId={user.id} onClose={() => setShowDisclaimerModal(false)} />
      )}
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
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 12,
  color: "#6A11CB",
}

const accordionToggle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
}

function chevronStyle(open: boolean): React.CSSProperties {
  return {
    fontSize: 24,
    fontWeight: 700,
    color: "#4C1D95",
    transition: "transform 0.2s",
    transform: open ? "rotate(0deg)" : "rotate(-90deg)",
    display: "inline-block",
    lineHeight: 1,
    userSelect: "none",
  }
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

const addButtonTooltipStyle = {
  position: "absolute" as const,
  bottom: "calc(100% + 8px)",
  left: "50%",
  transform: "translateX(-50%)",
  background: "linear-gradient(135deg, #6A11CB, #FF7A00)",
  color: "#fff",
  padding: "8px 10px",
  borderRadius: 6,
  fontSize: 12,
  lineHeight: 1.3,
  whiteSpace: "nowrap" as const,
  zIndex: 20,
  boxShadow: "0 6px 20px rgba(106,17,203,0.35)",
}

const buttonGhostDanger = {
  background: "#fff",
  color: "#B91C1C",
  border: "1px solid #FECACA",
  borderRadius: 8,
  padding: "7px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
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

const labelCell: React.CSSProperties = {
  flex: 2,
  minWidth: 0,
  overflow: "hidden",
}

const labelBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#EEF2FF",
  color: "#4338CA",
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
}

const paymentLoadingContainer: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#F9FAFB",
  fontFamily: "'Inter', system-ui, sans-serif",
  padding: 40,
}
