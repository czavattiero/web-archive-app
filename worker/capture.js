import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import { DateTime } from "luxon"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ✅ Calculate next capture at 9 AM Alberta time
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
      console.log(`❌ Attempt ${attempt} failed`)

      if (attempt === maxRetries) {
        throw err
      }

      await page.waitForTimeout(5000)
    }
  }
}

async function runWorker() {
  console.log("🚀 Worker started")

  const immediateCapture = process.env.IMMEDIATE_CAPTURE === "true"
  console.log("Mode:", immediateCapture ? "IMMEDIATE (new URL)" : "SCHEDULED")

  const albertaTime = DateTime.now().setZone("America/Edmonton")
  const timestamp = albertaTime.toFormat("MMM d, yyyy, h:mm a")
  console.log("Current Alberta time:", timestamp)

  let query = supabase
    .from("urls")
    .select("*")
    .eq("status", "active")

  // For immediate captures, get the most recently added URL
  if (immediateCapture) {
    query = query.order("created_at", { ascending: false }).limit(1)
  }

  const { data: urls, error } = await query

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs found")
    return
  }

  console.log(`📦 Found ${urls.length} URLs to capture`)

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

    const toleranceMs = 10 * 60 * 1000 // 10 minutes

    if (immediateCapture) {
      // Immediate capture mode: capture this URL now
      shouldCapture = true
      console.log("🔥 IMMEDIATE CAPTURE → capturing now")
    } else if (!lastCaptured) {
      // No previous capture: capture now
      shouldCapture = true
      console.log("🔥 NEW URL → capturing now")
    } else if (
      nextCapture &&
      now >= new Date(nextCapture.getTime() - toleranceMs)
    ) {
      // Scheduled capture time has arrived (with 10 min tolerance)
      shouldCapture = true
      console.log("⏰ SCHEDULED (with buffer) → capturing now")
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
        file_path: uploadData.path,
        user_id: item.user_id,
        status: "success",
      })

      let updateData = {
        last_captured_at: new Date().toISOString(),
      }

      // Update next capture time based on schedule type
      if (!immediateCapture) {
        updateData.next_capture_at = calculateNextCapture(item.schedule_type)
      }

      updateData.status = "active"

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

runWorker()