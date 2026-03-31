import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

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

// 🔥 Insert capture helper
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

// ✅ NEW: Safe next-date calculator (NO mutation bugs)
function getNextCaptureDate(urlObj) {
  const base = new Date()

  switch (urlObj.schedule_type) {
    case "weekly":
      return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)

    case "biweekly":
      return new Date(base.getTime() + 14 * 24 * 60 * 60 * 1000)

    case "29days":
      return new Date(base.getTime() + 29 * 24 * 60 * 60 * 1000)

    case "30days":
      return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)

    case "custom":
      return null

    default:
      return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
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

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "America/Edmonton",
      })

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

      // ✅ FIXED SCHEDULING
      const nextDate = getNextCaptureDate(urlObj)

      if (urlObj.schedule_type === "custom") {
        await supabase
          .from("urls")
          .update({
            status: "completed",
            last_captured_at: new Date().toISOString(),
          })
          .eq("id", urlObj.id)
      } else {
        await supabase
          .from("urls")
          .update({
            next_capture_at: nextDate.toISOString(),
            last_captured_at: new Date().toISOString(),
          })
          .eq("id", urlObj.id)
      }

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
