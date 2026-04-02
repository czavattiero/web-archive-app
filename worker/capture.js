import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import { DateTime } from "luxon"

// Setup env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase environment variables")
  process.exit(1)
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🔁 Retry loader
async function loadPageWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`🌐 Attempt ${i + 1}: ${url}`)

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })

      return true
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed:`, error.message)

      if (i === retries) return false

      await new Promise((res) => setTimeout(res, 3000))
    }
  }
  return false
}

// 📥 Insert capture
async function insertCapture({ urlObj, file_path, status, error }) {
  const payload = {
    url_id: urlObj.id,
    user_id: urlObj.user_id,
    file_path: file_path || null,
    status,
    error: error || null,
    created_at: new Date().toISOString(),
  }

  const { error: insertError } = await supabase
    .from("captures")
    .insert([payload])

  if (insertError) {
    console.error("❌ Insert error:", insertError)
  } else {
    console.log("✅ Capture inserted")
  }
}

// 🧠 Scheduling engine (DST-safe)
function getNextCaptureDate(urlObj) {
  const now = DateTime.now().setZone("America/Edmonton")

  let next

  // ✅ CUSTOM (ONE-TIME)
  if (urlObj.schedule_type === "custom") {
    if (!urlObj.schedule_value) return null

    next = DateTime.fromFormat(
      urlObj.schedule_value,
      "yyyy-MM-dd",
      { zone: "America/Edmonton" }
    ).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })

    return next.toUTC().toJSDate()
  }

  // ✅ BASE: today at 9 AM Alberta
  next = now.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })

  if (now >= next) {
    next = next.plus({ days: 1 })
  }

  switch (urlObj.schedule_type) {
    case "weekly":
      next = next.plus({ weeks: 1 })
      break

    case "biweekly":
      next = next.plus({ weeks: 2 })
      break

    case "29days":
      next = next.plus({ days: 29 })
      break

    case "30days":
      next = next.plus({ days: 30 })
      break

    default:
      next = next.plus({ weeks: 1 })
  }

  return next.toUTC().toJSDate()
}

// 🚀 MAIN WORKER
async function run() {
  console.log("🚀 Worker started")

  const now = new Date().toISOString()

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")
    .lte("next_capture_at", now)

  if (error) {
    console.error("❌ Fetch error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs due for capture")
    return
  }

  console.log(`✅ Processing ${urls.length} URLs`)

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  })

  for (const urlObj of urls) {
    console.log("🔍 Processing:", urlObj.url)

    if (!urlObj.id || !urlObj.user_id) {
      console.error("❌ Missing id or user_id — skipping")
      continue
    }

    const page = await context.newPage()

    try {
      const loaded = await loadPageWithRetry(page, urlObj.url)

      if (!loaded) throw new Error("Failed after retries")

      await page.waitForTimeout(3000)

      const timestamp = DateTime.now()
        .setZone("America/Edmonton")
        .toFormat("MMM d, yyyy, h:mm a")

      const filePath = `${urlObj.id}-${Date.now()}.pdf`

      const pdfBuffer = await page.pdf({
        format: "A4",
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%;font-size:11px;padding:8px 12px;text-align:right;background:white;color:black;border-bottom:1px solid #ccc;">
            Captured: ${timestamp}
          </div>
        `,
        footerTemplate: `<div></div>`,
        margin: { top: "70px", bottom: "30px" },
        printBackground: true,
      })

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) throw new Error(uploadError.message)

      console.log("✅ Upload success:", filePath)

      await insertCapture({
        urlObj,
        file_path: filePath,
        status: "success",
        error: null,
      })

      // 🧠 UPDATE SCHEDULING
      const nextDate = getNextCaptureDate(urlObj)

      const updatePayload = {
        last_captured_at: new Date().toISOString(),
      }

      if (nextDate) {
        updatePayload.next_capture_at = nextDate.toISOString()
      } else {
        updatePayload.status = "completed"
        updatePayload.next_capture_at = null
      }

      await supabase
        .from("urls")
        .update(updatePayload)
        .eq("id", urlObj.id)

    } catch (err) {
      console.error("❌ Capture failed:", err.message)

      await insertCapture({
        urlObj,
        file_path: null,
        status: "failed",
        error: err.message,
      })
    }

    await page.close()
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
