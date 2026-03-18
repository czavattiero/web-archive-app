import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🌎 Alberta Time
function getAlbertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
  })
}

// ⏱ Scheduling logic
function getNextCaptureTime(urlRecord) {
  const now = Date.now()

  switch (urlRecord.schedule_type) {
    case "weekly":
      return new Date(now + 7 * 24 * 60 * 60 * 1000)

    case "biweekly":
      return new Date(now + 14 * 24 * 60 * 60 * 1000)

    case "monthly_29":
      return new Date(now + 29 * 24 * 60 * 60 * 1000)

    case "monthly_30":
      return new Date(now + 30 * 24 * 60 * 60 * 1000)

    case "custom_days":
      return new Date(now + (urlRecord.schedule_value || 1) * 24 * 60 * 60 * 1000)

    case "specific_date":
      return new Date(urlRecord.specific_date)

    default:
      return new Date(now + 15 * 60 * 1000)
  }
}

// 🌐 Proxy (Webshare)
const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

async function run() {
  console.log("🚀 Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (error) {
    console.error("❌ DB error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  console.log(`📦 Processing ${urls.length} URLs`)

  let browser

  try {
    browser = await chromium.launch({ headless: true })
    console.log("⚡ No proxy")
  } catch {
    browser = await chromium.launch({ headless: true, proxy })
    console.log("🌐 Using proxy")
  }

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log(`🌐 ${url}`)

    try {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

      // 🕒 Inject timestamp banner (SAFE, no overlap)
      const timestamp = getAlbertaTime()

      await page.evaluate((timestamp) => {
        const banner = document.createElement("div")
        banner.innerText = `Captured: ${timestamp}`

        banner.style.width = "100%"
        banner.style.padding = "10px"
        banner.style.background = "white"
        banner.style.color = "black"
        banner.style.fontSize = "12px"
        banner.style.textAlign = "center"
        banner.style.position = "relative"
        banner.style.zIndex = "9999"

        document.body.insertBefore(banner, document.body.firstChild)
        document.body.style.marginTop = "20px"
      }, timestamp)

      const pdfBuffer = await page.pdf({
        format: "A4",
      })

      const fileName = `captures/${id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.error("❌ Upload failed:", uploadError)

        await supabase.from("captures").insert({
          url_id: id,
          status: "failed",
          error: uploadError.message,
        })

        continue
      }

      // ✅ Save success
      await supabase.from("captures").insert({
        url_id: id,
        file_path: fileName,
        status: "success",
      })

      // ✅ Update schedule
      const nextCapture = getNextCaptureTime(urlRecord)

      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
          next_capture_at: nextCapture.toISOString(),
        })
        .eq("id", id)

      console.log(`✅ Done. Next: ${nextCapture}`)

      await context.close()
    } catch (err) {
      console.error("❌ Capture failed:", err)

      await supabase.from("captures").insert({
        url_id: id,
        status: "failed",
        error: err.message,
      })
    }
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
