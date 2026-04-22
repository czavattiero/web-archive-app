import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

// Resolve project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load env
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

console.log("SUPABASE_URL:", process.env.SUPABASE_URL)

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 60 * 60 * 1000 // 1 hour

async function handleRetry(url) {
  const { data: urlRecord, error: fetchError } = await supabase
    .from("urls")
    .select("retry_count")
    .eq("id", url.id)
    .single()

  if (fetchError) {
    console.error("❌ Failed to fetch retry_count for URL", url.id, fetchError.message)
    return
  }

  const currentRetries = urlRecord?.retry_count ?? 0
  const newRetryCount = currentRetries + 1

  if (newRetryCount < MAX_RETRIES) {
    const retryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString()
    const { error: updateError } = await supabase
      .from("urls")
      .update({
        retry_count: newRetryCount,
        next_capture_at: retryAt,
        status: "active",
      })
      .eq("id", url.id)
    if (updateError) {
      console.error("❌ Failed to schedule retry for URL", url.id, updateError.message)
    } else {
      console.log(`🔁 Retry ${newRetryCount}/${MAX_RETRIES} scheduled for: ${retryAt}`)
    }
  } else {
    // All retries exhausted — schedule next capture per the URL's schedule type
    const baseTime = new Date(url.next_capture_at || Date.now())
    let nextCapture

    switch (url.schedule_type) {
      case "custom":
        nextCapture = null
        break
      case "weekly":
        nextCapture = new Date(baseTime.getTime() + 7 * 86400000)
        break
      case "biweekly":
        nextCapture = new Date(baseTime.getTime() + 14 * 86400000)
        break
      case "29days":
        nextCapture = new Date(baseTime.getTime() + 29 * 86400000)
        break
      case "30days":
        nextCapture = new Date(baseTime.getTime() + 30 * 86400000)
        break
      default:
        nextCapture = new Date(baseTime.getTime() + 7 * 86400000)
    }

    const { error: updateError } = await supabase
      .from("urls")
      .update({
        retry_count: 0,
        next_capture_at: nextCapture,
        status: nextCapture === null ? "completed" : "active",
      })
      .eq("id", url.id)
    if (updateError) {
      console.error("❌ Failed to schedule next capture for URL", url.id, updateError.message)
    } else {
      console.log(`⚠️ All retries exhausted for URL ${url.id}. Next capture: ${nextCapture}`)
    }
  }
}

async function run() {

  console.log("🚀 Starting capture worker...")

  const now = new Date().toISOString()

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")
    .lte("next_capture_at", now)
    .limit(10)

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs to capture.")
    return
  }

  console.log(`Found ${urls.length} URLs to capture`)

  const browser = await chromium.launch({ headless: true })

  for (const url of urls) {

    try {

      console.log("🌐 Capturing:", url.url)

      const page = await browser.newPage()

      await page.goto(url.url, {
        waitUntil: "networkidle",
        timeout: 60000
      })

      await page.waitForTimeout(3000)

      // Scroll to load dynamic content
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight)
      })

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "America/Edmonton"
      })

      const captureId = Date.now()

      // ✅ SAFE banner (no overlap)
      await page.evaluate(({ timestamp, url, captureId }) => {

        const banner = document.createElement("div")

        banner.style.width = "100%"
        banner.style.background = "white"
        banner.style.color = "black"
        banner.style.fontFamily = "Arial, sans-serif"
        banner.style.fontSize = "14px"
        banner.style.padding = "12px"
        banner.style.borderBottom = "2px solid black"

        banner.innerHTML = `
          <div><strong>Captured:</strong> ${timestamp}</div>
          <div><strong>URL:</strong> ${url}</div>
          <div><strong>System:</strong> WebArchive</div>
          <div><strong>Capture ID:</strong> ${captureId}</div>
        `

        document.body.prepend(banner)

      }, { timestamp, url: url.url, captureId })

      // ✅ Generate PDF directly (NO local file)
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "40px",
          bottom: "40px",
          left: "25px",
          right: "25px"
        }
      })

      await page.close()

      const fileName = `capture-${url.id}-${Date.now()}.pdf`

      // ✅ Upload with error handling
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: false
        })

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)
        await handleRetry(url)
        continue
      }

      console.log("✅ File uploaded:", fileName)

      // ✅ Insert DB ONLY after successful upload
      const { error: dbError } = await supabase
        .from("captures")
        .insert({
          url_id: url.id,
          file_path: fileName,
          captured_at: new Date(),
          status: "success"
        })

      if (dbError) {
        console.error("❌ DB insert error:", dbError)
      }

      // ---------- SCHEDULING ----------

      const baseTime = new Date(url.next_capture_at || Date.now())
      let nextCapture

      switch (url.schedule_type) {

        case "custom":
          nextCapture = null
          break

        case "weekly":
          nextCapture = new Date(baseTime.getTime() + 7 * 86400000)
          break

        case "biweekly":
          nextCapture = new Date(baseTime.getTime() + 14 * 86400000)
          break

        case "29days":
          nextCapture = new Date(baseTime.getTime() + 29 * 86400000)
          break

        case "30days":
          nextCapture = new Date(baseTime.getTime() + 30 * 86400000)
          break

        default:
          nextCapture = new Date(baseTime.getTime() + 7 * 86400000)

      }

      await supabase
        .from("urls")
        .update({
          next_capture_at: nextCapture,
          status: nextCapture === null ? "completed" : "active",
          retry_count: 0,
        })
        .eq("id", url.id)

      console.log("📅 Next capture scheduled:", nextCapture)

    } catch (err) {

      console.error("❌ Capture failed:", err)

      await supabase.from("captures").insert({
        url_id: url.id,
        captured_at: new Date(),
        status: "failed"
      })

      await handleRetry(url)

    }

  }

  await browser.close()

  console.log("✅ Worker finished")

}

run()
