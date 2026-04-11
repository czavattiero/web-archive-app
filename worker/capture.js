import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

// Setup env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Retry loader
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
}

// Insert capture
async function insertCapture({ urlObj, file_path, status, error }) {
  await supabase.from("captures").insert([
    {
      url_id: urlObj.id,
      user_id: urlObj.user_id,
      file_path: file_path || null,
      status,
      error: error || null,
      created_at: new Date().toISOString(),
    },
  ])
}

// MAIN WORKER
async function run() {
  console.log("🚀 Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")

  if (error) {
    console.error("❌ Fetch error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs found")
    return
  }

  const browser = await chromium.launch({ headless: true })

  for (const item of urls) {
    const now = new Date()

    console.log("🧪 CHECK:", {
      id: item.id,
      last: item.last_captured_at,
      next: item.next_capture_at,
      now: now.toISOString(),
    })

    // 🔥 FIXED LOGIC
    if (!item.last_captured_at) {
      console.log("🟢 NEW URL → RUN")
    } else if (
      item.next_capture_at &&
      new Date(item.next_capture_at) <= now
    ) {
      console.log("🟡 SCHEDULED → RUN")
    } else {
      console.log("⛔ SKIPPED")
      continue
    }

    const page = await browser.newPage()

    try {
      const loaded = await loadPageWithRetry(page, item.url)

      if (!loaded) throw new Error("Page failed to load")

      await page.waitForTimeout(3000)

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "America/Edmonton",
      })

      const filePath = `${item.id}-${Date.now()}.pdf`

      const pdfBuffer = await page.pdf({
        format: "A4",
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%;font-size:11px;padding:8px;text-align:right;">
            Captured: ${timestamp}
          </div>
        `,
        footerTemplate: `<div></div>`,
        margin: { top: "60px", bottom: "30px" },
        printBackground: true,
      })

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) throw uploadError

      console.log("✅ Uploaded:", filePath)

      await insertCapture({
        urlObj: item,
        file_path: filePath,
        status: "success",
      })

      // 🔥 FIXED SCHEDULING
      let next = new Date()

      switch (item.schedule_type) {
        case "weekly":
          next.setDate(next.getDate() + 7)
          break
        case "biweekly":
          next.setDate(next.getDate() + 14)
          break
        case "29days":
          next.setDate(next.getDate() + 29)
          break
        case "30days":
          next.setDate(next.getDate() + 30)
          break
        case "custom":
          next = new Date(item.schedule_value)
          break
        default:
          next.setDate(next.getDate() + 7)
      }

      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
          next_capture_at: next.toISOString(),
        })
        .eq("id", item.id)

      console.log("📅 Next:", next)

    } catch (err) {
      console.error("❌ Failed:", err.message)

      await insertCapture({
        urlObj: item,
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