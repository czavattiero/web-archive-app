import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import { DateTime } from "luxon"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ✅ Calculate next capture at 9 AM Alberta time
function calculateNextCapture(scheduleType) {
  const now = DateTime.now().setZone("America/Edmonton")
  let next = now.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })

  switch (scheduleType) {
    case "weekly":
      next = now.plus({ days: 7 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "biweekly":
      next = now.plus({ days: 14 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "29 days":
      next = now.plus({ days: 29 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "30 days":
      next = now.plus({ days: 30 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
  }

  return next.toUTC().toISO()
}

async function runWorker() {
  console.log("🚀 Worker started")

  const immediateCapture = process.env.IMMEDIATE_CAPTURE === "true"
  console.log("Mode:", immediateCapture ? "IMMEDIATE (new URL)" : "SCHEDULED")

  const now = DateTime.now().setZone("America/Edmonton")
  const timestamp = now.toFormat("MMM d, yyyy, h:mm a")
  console.log("Current Alberta time:", timestamp)

  let query = supabase
    .from("urls")
    .select("*")
    .eq("status", "active")

  // For immediate captures, get the most recently added URL
  if (immediateCapture) {
    query = query.order("created_at", { ascending: false }).limit(1)
  }

  const { data: urls, error } = await query

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs found")
    return
  }

  console.log(`📦 Found ${urls.length} URLs`)

  // ... rest of browser/capture logic stays the same ...

  // When updating URL after capture:
  let updateData = {
    last_captured_at: new Date().toISOString(),
  }

  if (!immediateCapture) {
    // Only update next_capture_at for scheduled runs
    updateData.next_capture_at = calculateNextCapture(item.schedule_type)
  }

  updateData.status = "active"

  await supabase
    .from("urls")
    .update(updateData)
    .eq("id", item.id)
}

runWorker()