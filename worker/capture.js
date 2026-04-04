import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log("🚀 Worker started")

  // 🔥 1. GET URLS TO CAPTURE
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")
    .limit(5)

  if (error) {
    console.error("Error fetching URLs:", error)
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

    console.log("Capturing:", url)

    try {
      const page = await browser.newPage()

      await page.setExtraHTTPHeaders({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      })

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

      // 🔥 TAKE SCREENSHOT
      const buffer = await page.screenshot({
        fullPage: true,
      })

      // 🔥 FILE NAME
      const fileName = `${item.id}-${Date.now()}.png`

      // 🔥 UPLOAD TO SUPABASE STORAGE
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, buffer, {
          contentType: "image/png",
        })

      if (uploadError) {
        throw uploadError
      }

      // 🔥 SAVE RECORD
      await supabase.from("captures").insert([
        {
          url_id: item.id,
          file_path: fileName,
          created_at: new Date().toISOString(),
        },
      ])

      // 🔥 UPDATE LAST CAPTURE
      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
        })
        .eq("id", item.id)

      console.log("✅ Success:", url)

      await page.close()
    } catch (err) {
      console.error("❌ Failed:", url, err.message)

      // 🔥 OPTIONAL: mark failed
      await supabase
        .from("urls")
        .update({
          status: "failed",
        })
        .eq("id", item.id)
    }
  }

  await browser.close()

  console.log("✅ Worker finished")
}

run()
