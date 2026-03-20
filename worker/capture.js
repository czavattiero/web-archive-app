console.log("🔍 DEBUG START")

console.log("SUPABASE_URL:", process.env.SUPABASE_URL)
console.log(
  "SUPABASE_SERVICE_ROLE_KEY EXISTS:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
)

import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getAlbertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
  })
}

function getNextCaptureTime(urlRecord) {
  const now = Date.now()

  switch (urlRecord.schedule_type) {
    case "weekly":
      return new Date(now + 7 * 24 * 60 * 60 * 1000)
    case "biweekly":
      return new Date(now + 14 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now + 15 * 60 * 1000)
  }
}

async function run() {
  console.log("🚀 Worker started")

  // 🔥 VERIFY ENV (CRITICAL)
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase ENV variables")
    return
  }

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")

  if (error) {
    console.error("❌ DB fetch error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  const browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log("🌐 Processing:", url)

    try {
      const context = await browser.newContext()
      const page = await context.newPage()

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })

      await page.waitForTimeout(5000)

      const timestamp = getAlbertaTime()

      await page.evaluate((timestamp) => {
        const banner = document.createElement("div")
        banner.innerText = `Captured: ${timestamp}`

        banner.style.width = "100%"
        banner.style.padding = "10px"
        banner.style.background = "white"
        banner.style.color = "black"
        banner.style.textAlign = "center"

        document.body.insertBefore(banner, document.body.firstChild)
      }, timestamp)

      const pdfBuffer = await page.pdf({ format: "A4" })

      const fileName = `${id}-${Date.now()}.pdf`

      // ✅ UPLOAD TO STORAGE
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
          created_at: new Date().toISOString(),
        })

        continue
      }

      // ✅ INSERT INTO DB (CRITICAL)
      const { error: insertError } = await supabase
        .from("captures")
        .insert({
          url_id: id,
          file_path: fileName,
          status: "success",
          created_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error("❌ INSERT FAILED:", insertError)
      } else {
        console.log("✅ DB insert success")
      }

      // ✅ UPDATE NEXT RUN
      const nextCapture = getNextCaptureTime(urlRecord)

      await supabase
        .from("urls")
        .update({
          next_capture_at: nextCapture.toISOString(),
        })
        .eq("id", id)

      await context.close()

    } catch (err) {
      console.error("❌ Capture error:", err)

      // ✅ ALWAYS LOG FAILURE
      await supabase.from("captures").insert({
        url_id: id,
        status: "failed",
        error: err.message,
        created_at: new Date().toISOString(),
      })
    }
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
