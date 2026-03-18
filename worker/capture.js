import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Proxy (Webshare-compatible)
const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

async function run() {
  console.log("🚀 Worker started")

  // Get URLs that are due
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

  console.log(`📦 Found ${urls.length} URLs to process`)

  // Launch browser (no proxy first → cheaper)
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    console.log("⚡ Running without proxy")
  } catch (err) {
    console.log("🌐 Falling back to proxy")
    browser = await chromium.launch({
      headless: true,
      proxy,
    })
  }

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

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.error("❌ Upload failed:", uploadError)

        // Save failure record
        await supabase.from("captures").insert({
          url_id: id,
          status: "failed",
          error: uploadError.message,
        })

        continue
      }

      // Save success record
      await supabase.from("captures").insert({
        url_id: id,
        file_path: fileName,
        status: "success",
      })

      // ✅ IMPORTANT: update scheduling
      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),

          // ⏱ schedule next run (15 minutes later)
          next_capture_at: new Date(
            Date.now() + 15 * 60 * 1000
          ).toISOString(),
        })
        .eq("id", id)

      console.log("✅ Capture saved")

      await context.close()
    } catch (err) {
      console.error("❌ Capture failed:", err)

      // Save failure record
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
