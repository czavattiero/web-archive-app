console.log("🔥 CORRECT WORKER FILE")

import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import crypto from "crypto"

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
  waitUntil: "domcontentloaded",
  timeout: 90000,
})

      await page.waitForTimeout(3000)

      // 🔥 TAKE SCREENSHOT
      const buffer = await page.screenshot({
        fullPage: true,
      })

      // 🔥 GENERATE HASH (FOR DIFF DETECTION)
      const hash = crypto
        .createHash("md5")
        .update(buffer)
        .digest("hex")

      // 🔥 GET LAST CAPTURE
      const { data: lastCapture } = await supabase
        .from("captures")
        .select("hash")
        .eq("url_id", item.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      const changed =
        !lastCapture || lastCapture.hash !== hash

      if (changed) {
        console.log("🚨 CHANGE DETECTED:", url)
      }

      // 🔥 FILE NAME
      const fileName = `${item.id}-${Date.now()}.png`

      // 🔥 UPLOAD TO STORAGE
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, buffer, {
          contentType: "image/png",
        })

      if (uploadError) {
        throw uploadError
      }

      // 🔥 SAVE CAPTURE RECORD
      await supabase.from("captures").insert([
        {
          url_id: item.id,
          file_path: fileName,
          hash,
          created_at: new Date().toISOString(),
        },
      ])

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
