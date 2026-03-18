import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  const browser = await chromium.launch({
    headless: true,
    proxy,
  })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log(`🌐 Capturing: ${url}`)

    try {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

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
        continue
      }

      await supabase.from("captures").insert({
        url_id: id,
        file_path: fileName,
      })

      console.log("✅ Capture saved")

      await context.close()
    } catch (err) {
      console.error("❌ Capture failed:", err)
    }
  }

  await browser.close()
}

run()
