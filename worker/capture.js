import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log("🚀 Worker started")

  // 🔥 1. GET URLS (ACTIVE + FAILED WITH RETRIES)
  const { data: urls, error } = await supabase
  .from("urls")
  .select("*")
  .or("status.eq.active,status.eq.failed,status.is.null")
  .or("retry_count.is.null,retry_count.lt.3")
  .limit(5)

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs to process")
    return
  }

  // 🔥 2. LAUNCH BROWSER
  const browser = await chromium.launch({
    headless: true,
  })

  for (const item of urls) {
    const url = item.url

    console.log("🌐 Capturing:", url)

    let page

    try {
      page = await browser.newPage()

      await page.setExtraHTTPHeaders({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      })

      await page.goto(url, {
  waitUntil: "networkidle",
  timeout: 90000,
})

      await page.waitForTimeout(3000)

      // 🔥 TAKE SCREENSHOT
     const buffer = await page.pdf({
  format: "A4",
  printBackground: true,
})

      // 🔥 FILE NAME
      const fileName = `screenshots/${item.id}-${Date.now()}.pdf`

      // 🔥 UPLOAD TO STORAGE
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, buffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        throw uploadError
      }

      // 🔥 SAVE CAPTURE RECORD
     console.log("🔥 INSERT BLOCK REACHED")

const { data, error } = await supabase
  .from("captures")
  .insert([
    {
      url_id: item.id,
      file_path: fileName,
      user_id: item.user_id,
      created_at: new Date().toISOString(),
    },
  ])
  .select()

console.log("📦 INSERT RESULT:", { data, error })

      // 🔥 SUCCESS → RESET RETRIES
      await supabase
        .from("urls")
        .update({
          status: "active",
          retry_count: 0,
          last_captured_at: new Date().toISOString(),
        })
        .eq("id", item.id)

      console.log("✅ Success:", url)

    } catch (err) {
      console.error("❌ Failed:", url, err.message)

      // 🔥 INCREMENT RETRY COUNT
      await supabase
        .from("urls")
        .update({
          status: "failed",
          retry_count: (item.retry_count || 0) + 1,
        })
        .eq("id", item.id)
    } finally {
      if (page) await page.close()
    }
  }

  await browser.close()

  console.log("🏁 Worker finished")
}

run()


