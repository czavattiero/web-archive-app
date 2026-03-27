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

// 🔁 Retry loader
async function loadPageWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`🌐 Attempt ${i + 1}: ${url}`)

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      })

      return true
    } catch (err) {
      console.error("❌ Attempt failed:", err.message)

      if (i === retries) return false

      await page.waitForTimeout(3000)
    }
  }
}

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
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
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

      if (!loaded) {
        throw new Error("Failed after retries")
      }

      // wait for rendering
      await page.waitForTimeout(3000)

      const filePath = `${urlObj.id}-${Date.now()}.pdf`

      const pdfBuffer = await page.pdf({
  format: "A4",

  displayHeaderFooter: true,

  headerTemplate: `
    <div style="
      width: 100%;
      font-size: 11px;
      padding: 8px 12px;
      text-align: right;
      background: white;
      color: black;
      border-bottom: 1px solid #ccc;
      box-sizing: border-box;
    ">
      <span>Captured: ${timestamp}</span>
    </div>
  `,

  footerTemplate: `<div></div>`,

  margin: {
    top: "70px",   // 🔥 INCREASED (VERY IMPORTANT)
    bottom: "30px",
  },

  printBackground: true,
})

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      console.log("✅ Upload success:", filePath)

      await insertCapture({
        urlObj,
        file_path: filePath,
        status: "success",
        error: null,
      })

      // ✅ schedule next run
      let next = new Date()

      switch (urlObj.schedule_type) {
        case "weekly":
          next.setDate(next.getDate() + 7)
          break
        case "daily":
          next.setDate(next.getDate() + 1)
          break
        case "monthly":
          next.setDate(next.getDate() + 30)
          break
        default:
          next.setDate(next.getDate() + 7)
      }

      await supabase
        .from("urls")
        .update({
          next_capture_at: next.toISOString(),
          last_captured_at: new Date().toISOString(),
        })
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

// 🔥 Insert function
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

run()
