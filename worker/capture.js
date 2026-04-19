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
    // Get all pending items from capture queue
    console.log("📋 Fetching capture queue (pending items)...")
    
    const { data: queueItems, error: queueError } = await supabase
      .from("capture_queue")
      .select("url_id, urls(*), id, user_id")
      .eq("status", "pending")

    if (queueError) {
      console.error("❌ Error fetching queue:", queueError)
      console.error("❌ Queue query failed - aborting worker")
      return
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("⚠️ No pending items in queue - nothing to capture")
      return
    }

    console.log(`📦 Found ${queueItems.length} pending queue items`)

    // Map queue items to URL objects
    urlsToCapture = queueItems.map(item => {
      console.log(`  - Queue item: ${item.id}, URL ID: ${item.url_id}`)
      return {
        ...item.urls,
        queue_id: item.id,
        is_immediate: true,
      }
    })

  } else {
    // SCHEDULED mode
    console.log("📋 Fetching active URLs due for scheduled capture...")
    
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

    console.log(`📋 Checking ${urls.length} URLs for due dates...`)

    const toleranceMs = 10 * 60 * 1000
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

  // ... rest of browser/capture code stays the same ...
}

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

    // Update queue status to processing (if from immediate queue)
    if (item.queue_id) {
      await supabase
        .from("capture_queue")
        .update({ status: "processing" })
        .eq("id", item.queue_id)
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
        console.error("❌ Page load failed:", err.message)

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: "Page load failed: " + err.message,
        })

        if (item.queue_id) {
          await supabase
            .from("capture_queue")
            .update({ status: "failed" })
            .eq("id", item.queue_id)
        }

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

        if (item.queue_id) {
          await supabase
            .from("capture_queue")
            .update({ status: "failed" })
            .eq("id", item.queue_id)
        }

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

      // Update URL with new capture time and next schedule
      let updateData = {
        last_captured_at: new Date().toISOString(),
        status: "active",
      }

      // Only update next_capture_at for scheduled captures
      if (!item.is_immediate) {
        updateData.next_capture_at = calculateNextCapture(item.schedule_type)
      } else {
        // For immediate captures, set next capture based on schedule
        updateData.next_capture_at = calculateNextCapture(item.schedule_type)
      }

      await supabase
        .from("urls")
        .update(updateData)
        .eq("id", item.id)

      // Mark queue item as processed (not completed - this prevents re-triggering)
      if (item.queue_id) {
        await supabase
          .from("capture_queue")
          .update({ status: "processed" })
          .eq("id", item.queue_id)
      }

      console.log("✅ URL updated - next capture:", updateData.next_capture_at)

    } catch (err) {
      console.error("❌ Capture failed:", err.message)

      await supabase.from("captures").insert({
        url_id: item.id,
        user_id: item.user_id,
        status: "failed",
        error: err.message,
      })

      if (item.queue_id) {
        await supabase
          .from("capture_queue")
          .update({ status: "failed" })
          .eq("id", item.queue_id)
      }
    }

    await page.close()
  }

  await browser.close()

  console.log("🎉 Worker finished")
}

runWorker()