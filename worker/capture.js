import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

dotenv.config()

// ✅ Init Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ✅ Helper: Calculate next capture date
function calculateNextCapture(scheduleType) {
  const now = new Date()

  switch (scheduleType) {
    case "weekly":
      now.setDate(now.getDate() + 7)
      return now.toISOString()

    case "biweekly":
      now.setDate(now.getDate() + 14)
      return now.toISOString()

    case "monthly":
      now.setMonth(now.getMonth() + 1)
      return now.toISOString()

    default:
      return null
  }
}

// 🚀 MAIN WORKER
async function runWorker() {
  console.log("🚀 Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs found")
    return
  }

  console.log(`📦 Found ${urls.length} URLs`)

  // 🔥 LAUNCH BROWSER ONCE (IMPORTANT)
  const browser = await chromium.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1280,800",
    ],
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.9",
    },
  })

  for (const item of urls) {
    console.log("🔎 Checking:", item.url)

    console.log("DEBUG URL:", {
      url: item.url,
      last_captured_at: item.last_captured_at,
      next_capture_at: item.next_capture_at,
    })

    const lastCaptured = item.last_captured_at
      ? new Date(item.last_captured_at)
      : null

    const nextCapture = item.next_capture_at
      ? new Date(item.next_capture_at)
      : null

    const now = new Date()

    let shouldCapture = false

    // 🚀 NEW URL
    if (!lastCaptured) {
      shouldCapture = true
      console.log("🔥 NEW URL → capturing now")
    }

    // ⏰ Scheduled
    else if (nextCapture && nextCapture <= now) {
      shouldCapture = true
      console.log("⏰ SCHEDULED → capturing now")
    }

    if (!shouldCapture) {
      console.log("⛔ Skipping:", item.url)
      continue
    }

    const page = await context.newPage()

    try {
      // 🔥 STEALTH PATCH
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false,
        })

        window.chrome = { runtime: {} }

        Object.defineProperty(navigator, "plugins", {
          get: () => [1, 2, 3],
        })

        Object.defineProperty(navigator, "languages", {
          get: () => ["en-US", "en"],
        })
      })

      console.log("🌍 Opening page...")

      try {
        await page.goto(item.url, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        })
      } catch (err) {
        console.error("❌ Page load failed:", err)

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: "Page load failed",
        })

        await page.close()
        continue
      }

      // ⏳ Let page fully render
      await page.waitForTimeout(3000)

      console.log("📄 Generating PDF...")

      const pdfBuffer = await page.pdf({
        format: "A4",
      })

      const fileName = `captures/${item.id}_${Date.now()}.pdf`

      console.log("📁 Uploading:", fileName)

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: uploadError.message,
        })

        await page.close()
        continue
      }

      const { data } = supabase.storage
        .from("captures")
        .getPublicUrl(fileName)

      const publicUrl = data.publicUrl

      console.log("✅ Uploaded:", publicUrl)

      // ✅ Insert capture
      await supabase.from("captures").insert({
        url_id: item.id,
        file_path: fileName,
        user_id: item.user_id,
        status: "success",
      })

      // 🔄 Update URL schedule
      const next = calculateNextCapture(item.schedule_type)

      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
          next_capture_at: next,
        })
        .eq("id", item.id)

      console.log("✅ URL updated")

    } catch (err) {
      console.error("❌ Capture failed:", err)

      await supabase.from("captures").insert({
        url_id: item.id,
        user_id: item.user_id,
        status: "failed",
        error: err.message,
      })
    }

    await page.close()
  }

  await browser.close()

  console.log("🎉 Worker finished")
}

runWorker()