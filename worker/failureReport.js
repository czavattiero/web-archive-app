import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { DateTime } from "luxon"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || "czavattiero@gmail.com"
const ZONE = "America/Edmonton"

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;")

// GitHub cron is UTC-only, so the workflow fires at both 01:00 UTC (7 PM MDT) and
// 02:00 UTC (7 PM MST). Only the firing that lands on 7 PM Alberta time sends the
// report; the other one exits. Manual runs (no SCHEDULE) always send.
function shouldRunNow() {
  const schedule = process.env.SCHEDULE
  if (!schedule) return true

  const now = DateTime.now().setZone(ZONE)
  if (schedule.startsWith("0 1 ")) return now.isInDST
  if (schedule.startsWith("0 2 ")) return !now.isInDST
  return true
}

async function runReport() {
  if (!shouldRunNow()) {
    console.log("⏭️ Not 7 PM Alberta time for this trigger (DST mismatch) — skipping")
    return
  }

  // Report on "today" in Alberta time. A delayed run that lands after midnight still
  // reports on the day that just ended.
  let now = DateTime.now().setZone(ZONE)
  if (now.hour < 12) now = now.minus({ days: 1 })
  const dayStart = now.startOf("day")
  const dayEnd = now.endOf("day")
  const dayLabel = dayStart.toFormat("MMM d, yyyy")

  console.log(`📋 Fetching failed captures for ${dayLabel} (Alberta time)...`)

  const { data: failures, error } = await supabase
    .from("captures")
    .select("url_id, user_id, error, label, created_at")
    .eq("status", "failed")
    .gte("created_at", dayStart.toUTC().toISO())
    .lte("created_at", dayEnd.toUTC().toISO())
    .order("created_at", { ascending: true })

  if (error) {
    console.error("❌ Error fetching failed captures:", error)
    process.exit(1)
  }

  // URLs that are past due but were never attempted (e.g. the daily run skipped them).
  const { data: overdue, error: overdueError } = await supabase
    .from("urls")
    .select("id, url, label, user_id, next_capture_at")
    .eq("status", "active")
    .lt("next_capture_at", DateTime.now().toUTC().toISO())
    .order("next_capture_at", { ascending: true })

  if (overdueError) {
    console.error("❌ Error fetching overdue URLs:", overdueError)
    process.exit(1)
  }

  if ((!failures || failures.length === 0) && (!overdue || overdue.length === 0)) {
    console.log("✅ No failed or missed captures today — no email sent")
    return
  }

  // Group repeated failures (retries) of the same URL into one row.
  const byUrl = new Map()
  for (const f of failures) {
    const entry = byUrl.get(f.url_id) || { ...f, count: 0 }
    entry.count += 1
    entry.error = f.error
    entry.created_at = f.created_at
    byUrl.set(f.url_id, entry)
  }
  const urlIds = [...byUrl.keys()].filter(Boolean)

  const { data: urls } = urlIds.length === 0 ? { data: [] } : await supabase
    .from("urls")
    .select("id, url")
    .in("id", urlIds)
  const urlById = new Map((urls || []).map(u => [u.id, u.url]))

  // Flag URLs that were captured successfully after failing (e.g. a retry worked).
  const { data: successes } = urlIds.length === 0 ? { data: [] } : await supabase
    .from("captures")
    .select("url_id, created_at")
    .eq("status", "success")
    .in("url_id", urlIds)
    .gte("created_at", dayStart.toUTC().toISO())
    .lte("created_at", dayEnd.toUTC().toISO())
  const recovered = new Set(
    (successes || [])
      .filter(s => new Date(s.created_at) > new Date(byUrl.get(s.url_id).created_at))
      .map(s => s.url_id)
  )

  const userEmails = new Map()
  const userIds = [...byUrl.values(), ...(overdue || [])].map(e => e.user_id)
  for (const userId of new Set(userIds)) {
    const { data } = await supabase.auth.admin.getUserById(userId)
    userEmails.set(userId, data?.user?.email || userId)
  }

  const entries = [...byUrl.values()]
  const stillFailing = entries.filter(e => !recovered.has(e.url_id)).length

  const rows = entries.map(e => {
    const url = urlById.get(e.url_id) || "(deleted URL)"
    const time = DateTime.fromISO(e.created_at, { zone: "utc" }).setZone(ZONE).toFormat("h:mm a")
    const status = recovered.has(e.url_id)
      ? `<span style="color:#15803d;">Recovered</span>`
      : `<span style="color:#b91c1c;">Failed</span>`
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;word-break:break-all;">
        ${escapeHtml(url)}${e.label ? `<br><span style="color:#888;">${escapeHtml(e.label)}</span>` : ""}
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(userEmails.get(e.user_id))}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(e.error)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">${time}${e.count > 1 ? ` (×${e.count})` : ""}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${status}</td>
    </tr>`
  }).join("")

  const overdueRows = (overdue || []).map(u => {
    const due = DateTime.fromISO(u.next_capture_at, { zone: "utc" }).setZone(ZONE).toFormat("MMM d, h:mm a")
    return `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;word-break:break-all;">
        ${escapeHtml(u.url)}${u.label ? `<br><span style="color:#888;">${escapeHtml(u.label)}</span>` : ""}
      </td>
      <td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(userEmails.get(u.user_id))}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;white-space:nowrap;">${due}</td>
    </tr>`
  }).join("")

  const failedSection = entries.length === 0 ? "" : `
  <h3 style="font-size:17px;color:#111;margin:20px 0 8px;">Failed captures</h3>
  <p style="font-size:14px;color:#555;margin-bottom:12px;">
    ${entries.length} URL(s) had failed captures today; ${stillFailing} not yet recovered.
  </p>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead>
      <tr style="text-align:left;background:#f5f5f5;">
        <th style="padding:8px;">URL</th>
        <th style="padding:8px;">User</th>
        <th style="padding:8px;">Last error</th>
        <th style="padding:8px;">Last failure</th>
        <th style="padding:8px;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`

  const overdueSection = overdueRows === "" ? "" : `
  <h3 style="font-size:17px;color:#111;margin:24px 0 8px;">Missed captures (past due, not attempted)</h3>
  <table style="border-collapse:collapse;width:100%;font-size:13px;">
    <thead>
      <tr style="text-align:left;background:#f5f5f5;">
        <th style="padding:8px;">URL</th>
        <th style="padding:8px;">User</th>
        <th style="padding:8px;">Was due</th>
      </tr>
    </thead>
    <tbody>${overdueRows}</tbody>
  </table>`

  const html = `
<div style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#333;">
  <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#111;">Capture problems – ${dayLabel}</h2>
${failedSection}
${overdueSection}
  <p style="font-size:12px;color:#aaa;margin-top:24px;">Automated daily report from Timedshot.</p>
</div>`

  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set — skipping report email")
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: emailError } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_ALERT_EMAIL,
    subject: `⚠️ Capture report – ${entries.length} failed, ${(overdue || []).length} missed – ${dayLabel}`,
    html,
  })

  if (emailError) {
    console.error("❌ Failed to send report email:", emailError.message || emailError)
    process.exit(1)
  }

  console.log(`✉️ Report sent to ${ADMIN_ALERT_EMAIL} (${entries.length} failed, ${(overdue || []).length} missed)`)
}

runReport()
