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
    case "29days":
      next = now.plus({ days: 29 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "30days":
      next = now.plus({ days: 30 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
  }

  return next.toUTC().toISO()
}

async function captureWithRetry(page, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🌐 Attempt ${attempt}: Opening ${url}`)

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })

      await page.waitForTimeout(5000)

      const content = await page.content()

      if (
        content.includes("security verification") ||
        content.includes("Checking your browser") ||
        content.includes("Access denied")
      ) {
        console.log(`⚠️ Block detected (attempt ${attempt})`)

        if (attempt < maxRetries) {
          console.log("🔁 Retrying...")
          await page.waitForTimeout(5000)
          continue
        } else {
          throw new Error("Blocked by Cloudflare after retries")
        }
      }

      console.log("✅ Page loaded successfully")
      return true

    } catch (err) {
      console.log(`❌ Attempt ${attempt} failed`)

      if (attempt === maxRetries) {
        throw err
      }

      await page.waitForTimeout(5000)
    }
  }
}

async function runWorker() {
  console.log("🚀 Worker started")

  const immediateCapture = process.env.IMMEDIATE_CAPTURE === "true"
  const captureUrlId = process.env.CAPTURE_URL_ID || "all"
  
  console.log("Mode:", immediateCapture ? "IMMEDIATE (new URL)" : "SCHEDULED")
  console.log("URL ID:", captureUrlId)

  const albertaTime = DateTime.now().setZone("America/Edmonton")
  const timestamp = albertaTime.toFormat("MMM d, yyyy, h:mm a")
  console.log("Current Alberta time:", timestamp)

  let query = supabase
    .from("urls")
    .select("*")
    .eq("status", "active")

  // For immediate captures with a specific URL ID, capture only that URL
  if (immediateCapture && captureUrlId !== "all") {
    query = query.eq("id", captureUrlId)
  }

  const { data: urls, error } = await query
  // ... rest stays the same

runWorker()}