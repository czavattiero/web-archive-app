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

async function captureWithRetry(page, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🌐 Attempt ${attempt}: Opening ${url}`)

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })

      await page.waitForTimeout(5000)

      const content = await page.content()

      if (
        content.includes("security verification") ||
        content.includes("Checking your browser") ||
        content.includes("Access denied")
      ) {
        console.log(`⚠️ Block detected (attempt ${attempt})`)

        if (attempt < maxRetries) {
          console.log("🔁 Retrying...")
          await page.waitForTimeout(5000)
          continue
        } else {
          throw new Error("Blocked by Cloudflare after retries")
        }
      }

      console.log("✅ Page loaded successfully")
      return true

    } catch (err) {
      console.log(`❌ Attempt ${attempt} failed`)

      if (attempt === maxRetries) {
        throw err
      }

      await page.waitForTimeout(5000)
    }
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

  // 🔥 Launch browser once
  const browser = await chromium.launch({
    headless: true,
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

    const lastCaptured = item.last_captured_at
      ? new Date(item.last_captured_at)
      : null

    const nextCapture = item.next_capture_at
      ? new Date(item.next_capture_at)
      : null

    const now = new Date()

    let shouldCapture = false

if (!lastCaptured) {
  shouldCapture = true
  console.log("🔥 NEW URL → capturing now")

if (!lastCaptured) {
  shouldCapture = true
  console.log("🔥 NEW URL → capturing now")

} else if (
  nextCapture &&
  now >= nextCapture &&
  (!lastCaptured || lastCaptured < nextCapture)
) {
  shouldCapture = true
  console.log("⏰ SCHEDULED → capturing now")
}

    if (!shouldCapture) {
      console.log("⛔ Skipping:", item.url)
      continue
    }

    const page = await context.newPage()

    try {
      // 🔥 Stealth patch
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
        await captureWithRetry(page, item.url)

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

      // ⏳ Wait for rendering
      await page.waitForTimeout(3000)

      // ✅ CORRECT TIMESTAMP PLACEMENT
      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "America/Edmonton",
      })

      console.log("📄 Generating PDF...")

      const pdfBuffer = await page.pdf({
        format: "A4",
        displayHeaderFooter: true,

        headerTemplate: `
          <div style="width:100%; font-size:11px; padding:8px 12px; text-align:right; background:white; color:black; border-bottom:1px solid #ccc;">
            Captured: ${timestamp}
          </div>
        `,

        footerTemplate: `<div></div>`,

        margin: {
          top: "70px",
          bottom: "30px",
        },

        printBackground: true,
      })

      const fileName = `${item.id}_${Date.now()}.pdf`

      console.log("📁 Uploading:", fileName)

      const { data: uploadData, error: uploadError } = await supabase.storage
  .from("captures")
  .upload(fileName, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  })

console.log("UPLOAD RESULT:", uploadData)
console.log("UPLOAD ERROR:", uploadError)

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

      console.log("✅ Uploaded:", data.publicUrl)

      await supabase.from("captures").insert({
  url_id: item.id,
  file_path: uploadData.path, // ✅ FIX
  user_id: item.user_id,
  status: "success",
})

  let updateData = {
  last_captured_at: new Date().toISOString(),
}

if (item.schedule_type === "custom") {
  const nextCapture = item.next_capture_at
    ? new Date(item.next_capture_at)
    : null

  const now = new Date()

  if (nextCapture && now >= nextCapture) {
    // ✅ Scheduled run completed
    updateData.status = "completed"
  } else {
    // ✅ Still waiting for scheduled date
    updateData.status = "active"
  }

} else {
  // recurring schedules
  updateData.next_capture_at = calculateNextCapture(item.schedule_type)
  updateData.status = "active"
}

await supabase
  .from("urls")
  .update(updateData)
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

runWorker()}