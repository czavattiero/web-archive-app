import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import { DateTime } from "luxon"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function calculateNextCapture(scheduleType) {
  const now = DateTime.now().setZone("America/Edmonton")
  let next = now.plus({ days: 1 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })

  switch (scheduleType) {
    case "weekly":
      next = now.plus({ days: 7 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "biweekly":
      next = now.plus({ days: 14 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "29days":
      next = now.plus({ days: 29 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
    case "30days":
      next = now.plus({ days: 30 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
      break
  }

  return next.toUTC().toISO()
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
      console.log(`❌ Attempt ${attempt} failed: ${err.message}`)

      if (attempt === maxRetries) {
        throw err
      }

      await page.waitForTimeout(5000)
    }
  }
}

async function runWorker() {
  console.log("🚀 Worker started")

  const captureMode = process.env.CAPTURE_MODE || "SCHEDULED"
  console.log("Capture mode:", captureMode)

  const albertaTime = DateTime.now().setZone("America/Edmonton")
  const timestamp = albertaTime.toFormat("MMM d, yyyy, h:mm a")
  console.log("Current Alberta time:", timestamp)

  let urlsToCapture = []

  if (captureMode === "IMMEDIATE") {
    // Get all URLs that have NEVER been captured (last_captured_at = NULL)
    console.log("📋 Fetching URLs that need immediate capture...")
    
    const { data: urls, error } = await supabase
      .from("urls")
      .select("*")
      .eq("status", "active")
      .is("last_captured_at", null)  // NULL = never been captured

    if (error) {
      console.error("❌ Error fetching URLs:", error)
      return
    }

    if (!urls || urls.length === 0) {
      console.log("⚠️ No URLs needing immediate capture")
      return
    }

    console.log(`📦 Found ${urls.length} URL(s) needing immediate capture`)
    urlsToCapture = urls

  } else {
    // SCHEDULED mode: capture URLs where next_capture_at has arrived
    console.log("📋 Fetching URLs due for scheduled capture...")
    
    const { data: urls, error } = await supabase
      .from("urls")
      .select("*")
      .eq("status", "active")

    if (error) {
      console.error("❌ Error fetching URLs:", error)
      return
    }

    if (!urls || urls.length === 0) {
      console.log("⚠️ No active URLs found")
      return
    }

    const toleranceMs = 10 * 60 * 1000 // 10 minute tolerance
    const now = new Date()

    urlsToCapture = urls.filter(item => {
      const nextCapture = item.next_capture_at ? new Date(item.next_capture_at) : null
      if (!nextCapture) {
        console.log(`  ⏭️ ${item.url} - no next_capture_at`)
        return false
      }

      const isDue = now >= new Date(nextCapture.getTime() - toleranceMs)
      console.log(`  ${isDue ? "✅" : "⏭️"} ${item.url} - due: ${nextCapture.toISOString()}`)
      return isDue
    })

    if (urlsToCapture.length === 0) {
      console.log("⛔ No URLs are due for capture")
      return
    }
  }

  console.log(`\n🚀 Starting capture of ${urlsToCapture.length} URL(s)...\n`)

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

  // Process each URL
  for (const item of urlsToCapture) {
    console.log("🔎 Capturing:", item.url)

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
        console.error("❌ Page load failed:", err.message)

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: "Page load failed: " + err.message,
        })

        await page.close()
        continue
      }

      // ⏳ Wait for rendering
      await page.waitForTimeout(3000)

      // ✅ TIMESTAMP IN ALBERTA TIME
      const captureTime = DateTime.now().setZone("America/Edmonton")
      const captureTimestamp = captureTime.toFormat("MMM d, yyyy, h:mm a")

      console.log("📄 Generating PDF...")

      const pdfBuffer = await page.pdf({
        format: "A4",
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width:100%; font-size:11px; padding:8px 12px; text-align:right; background:white; color:black; border-bottom:1px solid #ccc;">
            Captured: ${captureTimestamp}
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

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: "Upload failed: " + uploadError.message,
        })

        await page.close()
        continue
      }

      console.log("✅ Uploaded:", fileName)

      // Insert capture record
      await supabase.from("captures").insert({
        url_id: item.id,
        file_path: uploadData.path,
        user_id: item.user_id,
        status: "success",
      })

      // Update URL: set last_captured_at and next_capture_at
      const updateData = {
        last_captured_at: new Date().toISOString(),
        next_capture_at: calculateNextCapture(item.schedule_type),
        status: "active",
      }

      await supabase
        .from("urls")
        .update(updateData)
        .eq("id", item.id)

      console.log("✅ URL updated - next capture:", updateData.next_capture_at)

    } catch (err) {
      console.error("❌ Capture failed:", err.message)

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