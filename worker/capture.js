import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import { Resend } from "resend"
import { DateTime } from "luxon"
import { CLOUDFLARE_BLOCK_PATTERN } from "./cloudflareDetection.js"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"
let resendClient = null

function calculateNextCapture(scheduleType, prevScheduledAt) {
  let daysToAdd

  switch (scheduleType) {
    case "custom":
      return null
    case "weekly":
      daysToAdd = 7
      break
    case "biweekly":
      daysToAdd = 14
      break
    case "29days":
      daysToAdd = 29
      break
    case "30days":
      daysToAdd = 30
      break
    default:
      daysToAdd = 1
  }

  const now = DateTime.now().setZone("America/Edmonton")

  // When a previous scheduled time is provided and already in the past, advance directly
  // from it (preserving its time-of-day offset) so that duplicate URLs with different
  // scheduled times don't converge onto the same next_capture_at after being processed
  // in the same worker run.
  if (prevScheduledAt) {
    const prev = DateTime.fromISO(prevScheduledAt, { zone: "utc" }).setZone("America/Edmonton")
    if (prev <= now) {
      const next = prev.plus({ days: daysToAdd })
      // Only use prev-based next if it lands in the future; otherwise fall through to
      // the now-based default so a severely overdue URL gets a sensible schedule.
      if (next > now) {
        return next.toUTC().toISO()
      }
    }
  }

  // Default: advance from now and normalise to 9 AM Alberta.
  // Used for new/immediate captures and when the URL is severely overdue.
  return now
    .plus({ days: daysToAdd })
    .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toISO()
}

const MIN_BODY_TEXT_LENGTH = 200
const EMPTY_BODY_RETRY_DELAY_MS = 10000

const EXTENDED_RETRY_DELAYS = [
  5 * 60 * 1000,   // 5 minutes
  10 * 60 * 1000,  // 10 minutes
  15 * 60 * 1000,  // 15 minutes
]
const MAX_RETRIES = EXTENDED_RETRY_DELAYS.length // 3
const safeName = (s) =>
  (s || "")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 40)

async function captureWithRetry(page, url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🌐 Attempt ${attempt}: Opening ${url}`)

    try {
      await page.goto(url, {
        // domcontentloaded prevents timeouts on Indeed/Glassdoor
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })

      await page.waitForTimeout(8000)

      const content = await page.content()

      if (CLOUDFLARE_BLOCK_PATTERN.test(content)) {
        console.log(`⚠️ Cloudflare block detected (attempt ${attempt})`)

        if (attempt < maxRetries) {
          console.log("🔁 Retrying...")
          await page.waitForTimeout(5000)
          continue
        } else {
          throw new Error("Blocked by Cloudflare")
        }
      }

      const bodyText = await page.evaluate(() => document.body?.innerText?.trim() ?? "")
      if (bodyText.length < MIN_BODY_TEXT_LENGTH) {
        console.log(`⚠️ Page appears empty or blocked (body text: ${bodyText.length} chars)`)
        if (attempt < maxRetries) {
          await page.waitForTimeout(EMPTY_BODY_RETRY_DELAY_MS)
          continue
        } else {
          throw new Error("Page rendered with no content — possible bot block or login wall")
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

async function sendFailureEmail(item, errorMessage) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set — skipping failure email")
    return
  }

  try {
    if (!resendClient) {
      resendClient = new Resend(process.env.RESEND_API_KEY)
    }
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserById(item.user_id)

    if (userError || !userData?.user?.email) {
      throw new Error(userError?.message || `Missing email for user ${item.user_id}`)
    }

    const userEmail = userData.user.email
    let captureHostname = "unknown-host"
    let captureHref = "#"
    try {
      const parsedUrl = new URL(item.url)
      captureHostname = parsedUrl.hostname
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        captureHref = parsedUrl.toString()
      }
    } catch {
      console.warn("⚠️ Invalid URL while preparing failure email")
    }
    const safeCaptureHref = captureHref
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;")
    const safeErrorMessage = String(errorMessage || "Unknown error")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")

    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#6A11CB,#FF7A00);display:inline-block;padding:12px 28px;border-radius:12px;">
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Timedshot</span>
    </div>
  </div>
  <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111;">Capture failed ⚠️</h2>
  <p style="font-size:15px;color:#555;margin-bottom:12px;">
    We were unable to capture <a href="${safeCaptureHref}" style="color:#6A11CB;">${safeCaptureHref}</a>.
  </p>
  <p style="font-size:15px;color:#555;margin-bottom:12px;">
    <strong>Reason:</strong> ${safeErrorMessage}
  </p>
  <p style="font-size:15px;color:#555;margin-bottom:28px;">
    Our system will automatically retry the capture. You will be notified if it continues to fail.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <p style="font-size:12px;color:#aaa;text-align:center;">
    This is an automated message from Timedshot.
  </p>
</div>`

    const { error: emailError } = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: userEmail,
      subject: `⚠️ Capture failed – ${captureHostname}`,
      html,
    })

    if (emailError) {
      throw new Error(emailError.message || JSON.stringify(emailError))
    }

    console.log(`✉️ Failure email sent to ${userEmail}`)
  } catch (emailErr) {
    console.error(`❌ Failed to send failure email: ${emailErr.message}`)
  }
}

async function handleRetry(item, captureMode) {
  const { data: urlRecord, error: fetchError } = await supabase
    .from("urls")
    .select("retry_count")
    .eq("id", item.id)
    .single()

  if (fetchError) {
    console.error("❌ Failed to fetch retry_count for URL", item.id, fetchError.message)
    return
  }

  const currentRetries = urlRecord?.retry_count ?? 0
  const newRetryCount = currentRetries + 1

  if (newRetryCount <= MAX_RETRIES) {
    const delayMs = EXTENDED_RETRY_DELAYS[currentRetries]
    const delayMin = delayMs / (60 * 1000)
    const retryAt = new Date(Date.now() + delayMs).toISOString()
    const { error: updateError } = await supabase
      .from("urls")
      .update({
        retry_count: newRetryCount,
        next_capture_at: retryAt,
        status: "active",
      })
      .eq("id", item.id)
    if (updateError) {
      console.error("❌ Failed to schedule retry for URL", item.id, updateError.message)
    } else {
      console.log(`🔁 Extended retry ${newRetryCount}/${MAX_RETRIES} in ${delayMin} min scheduled for: ${retryAt}`)
    }
  } else {
    let nextCaptureAt
    let nextStatus

    if (item.schedule_type === "custom") {
      if (captureMode === "IMMEDIATE") {
        if (item.schedule_value) {
          const parsedDate = DateTime.fromISO(item.schedule_value, { zone: "America/Edmonton" })
          if (parsedDate.isValid) {
            nextCaptureAt = parsedDate
              .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
              .toUTC()
              .toISO()
            nextStatus = "active"
          } else {
            nextCaptureAt = null
            nextStatus = "completed"
          }
        } else {
          nextCaptureAt = null
          nextStatus = "completed"
        }
      } else {
        nextCaptureAt = null
        nextStatus = "completed"
      }
    } else {
      nextCaptureAt = calculateNextCapture(item.schedule_type)
      nextStatus = "active"
    }

    const { error: updateError } = await supabase
      .from("urls")
      .update({
        retry_count: 0,
        next_capture_at: nextCaptureAt,
        status: nextStatus,
      })
      .eq("id", item.id)
    if (updateError) {
      console.error("❌ Failed to schedule next capture for URL", item.id, updateError.message)
    } else {
      console.log(`⚠️ All retries exhausted for ${item.url}. Next capture: ${nextCaptureAt}`)
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
    console.log("📋 Fetching URLs that need immediate capture...")

    const { data: urls, error } = await supabase
      .from("urls")
      .select("*")
      .eq("status", "active")
      .is("last_captured_at", null)

    if (error) {
      console.error("❌ Error fetching URLs:", error)
      return
    }

    if (!urls || urls.length === 0) {
      console.log("⚠️ No URLs needing immediate capture")
      return
    }

    console.log(`📦 Found ${urls.length} URL(s) needing immediate capture`)

    for (const url of urls) {
      console.log(`🔒 Locking URL: ${url.id}`)
      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date(Date.now() - 1000).toISOString(),
        })
        .eq("id", url.id)
    }

    urlsToCapture = urls

  } else {
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

  // ✅ CHANGE 1: Use Browserless stealth + residential proxy + CAPTCHA solving
  // Uses chromium.connect() (not connectOverCDP) with the /chromium/stealth path
  // and the correct production-sfo endpoint
  let browser
  if (process.env.BROWSERLESS_TOKEN) {
    console.log("🌐 Connecting to Browserless with stealth + residential proxy...")
    browser = await chromium.connectOverCDP(
      `wss://production-sfo.browserless.io/chromium/stealth?token=${process.env.BROWSERLESS_TOKEN}&proxy=residential&proxyCountry=ca&solveCaptchas=true`
    )
    console.log("✅ Connected to Browserless")
  } else {
    console.log("🖥️ Launching local Playwright browser...")
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1280,800",
      ],
    })
  }

  // Process each URL
  for (const item of urlsToCapture) {
    console.log("🔎 Capturing:", item.url)

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
      extraHTTPHeaders: { "accept-language": "en-US,en;q=0.9" },
    })

    const page = await context.newPage()

    try {
      // 🔥 Stealth patch — extra layer on top of Browserless stealth
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
        Object.defineProperty(navigator, "permissions", {
          get: () => ({
            query: () => Promise.resolve({ state: "granted" }),
          }),
        })
        Object.defineProperty(screen, "colorDepth", { get: () => 24 })
        Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 })
        Object.defineProperty(navigator, "deviceMemory", { get: () => 8 })
      })

      console.log("🌍 Opening page...")

      try {
        await captureWithRetry(page, item.url)
      } catch (err) {
        console.error("❌ Page load failed:", err.message)
        const errorMessage = "Page load failed: " + err.message

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: errorMessage,
          label: item.label || null,
        })

        await sendFailureEmail(item, errorMessage)
        await handleRetry(item, captureMode)

        await page.close()
        await context.close()
        continue
      }

      await page.waitForTimeout(3000)

      const captureTime = DateTime.now().setZone("America/Edmonton")
      const captureDate = captureTime.toFormat("yyyy-MM-dd")
      const captureTimestamp = captureTime.toFormat("MMM d, yyyy, h:mm a")

      let rawJobTitle = ""
      try {
        rawJobTitle = await page.evaluate(() => {
          try {
            const h1Text = document.querySelector("h1")?.textContent?.trim()
            if (h1Text) return h1Text
            return (document.title || "").trim()
          } catch {
            return ""
          }
        })
      } catch {
        // keep fallback job title
      }
      const safeJobTitle = safeName(rawJobTitle) || item.id

      // Neutralize ALL fixed/sticky elements so they flow in normal document order
      // and cannot overlap the timestamp banner injected below.
      // Using "*" catches every element (including those without a class/id).
      // Resetting top to "auto" prevents a relative-offset from a former sticky top value.
      await page.evaluate(() => {
        document.querySelectorAll("*").forEach(el => {
          try {
            const computed = window.getComputedStyle(el)
            if (computed.position === "fixed" || computed.position === "sticky") {
              el.style.setProperty("position", "relative", "important")
              el.style.setProperty("top", "auto", "important")
            }
          } catch {
            // ignore elements that can't be styled
          }
        })
      })

      console.log("📄 Generating PDF...")

      // Use displayHeaderFooter so the timestamp banner is repeated on every page.
      // Fixed/sticky elements have already been neutralised above, so the header
      // template will not overlap any site logo or nav bar.
      const escUrl = item.url.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:10px;padding:4px 12px;border-bottom:1px solid #ccc;color:#000;background:#fff;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">${escUrl}</span><span style="white-space:nowrap;margin-left:8px;">Captured: ${captureTimestamp}</span></div>`,
        footerTemplate: "<span></span>",
        margin: {
          top: "40px",
          bottom: "30px",
        },
      })

      const dateFolder = captureDate
      let siteName = "unknown"
      try {
        const hostname = new URL(item.url).hostname.toLowerCase().replace(/^www\./, "")
        const labels = hostname.split(".").filter(Boolean)
        if (labels.length >= 3 && labels[labels.length - 1].length === 2 && labels[labels.length - 2].length <= 3) {
          siteName = labels[labels.length - 3]
        } else if (labels.length >= 2) {
          siteName = labels[labels.length - 2]
        } else if (labels.length === 1) {
          siteName = labels[0]
        }
      } catch {
        // keep fallback site name
      }
      const safeSiteFolder = safeName(siteName) || "unknown"
      const safeUrlLabel = item.label ? safeName(item.label) : null
      const fileBase = safeUrlLabel ? `${safeUrlLabel}_${captureDate}` : `${safeJobTitle}_${captureDate}`
      const fileName = `${dateFolder}/${safeSiteFolder}/${fileBase}.pdf`

      console.log("📁 Uploading:", fileName)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)
        const errorMessage = "Upload failed: " + uploadError.message

        await supabase.from("captures").insert({
          url_id: item.id,
          user_id: item.user_id,
          status: "failed",
          error: errorMessage,
          label: item.label || null,
        })

        await sendFailureEmail(item, errorMessage)
        await handleRetry(item, captureMode)

        await page.close()
        await context.close()
        continue
      }

      console.log("✅ Uploaded:", fileName)

      await supabase.from("captures").insert({
        url_id: item.id,
        file_path: uploadData.path,
        user_id: item.user_id,
        status: "success",
        label: item.label || null,
      })

      let nextCaptureAt
      let nextStatus

      if (item.schedule_type === "custom") {
        if (captureMode === "IMMEDIATE") {
          const parsedDate = DateTime.fromISO(item.schedule_value, { zone: "America/Edmonton" })
          if (!parsedDate.isValid) {
            console.error(`❌ Invalid schedule_value "${item.schedule_value}" for URL ${item.id} — marking completed`)
            nextCaptureAt = null
            nextStatus = "completed"
          } else {
            nextCaptureAt = parsedDate
              .set({ hour: 9, minute: 0, second: 0, millisecond: 0 })
              .toUTC()
              .toISO()
            nextStatus = "active"
          }
        } else {
          nextCaptureAt = null
          nextStatus = "completed"
        }
      } else {
        nextCaptureAt = calculateNextCapture(item.schedule_type, item.next_capture_at)
        nextStatus = "active"
      }

      const updateData = {
        last_captured_at: new Date().toISOString(),
        next_capture_at: nextCaptureAt,
        status: nextStatus,
        retry_count: 0,
      }

      await supabase
        .from("urls")
        .update(updateData)
        .eq("id", item.id)

      console.log("✅ URL updated - next capture:", updateData.next_capture_at)

      if (!process.env.RESEND_API_KEY) {
        console.warn("⚠️ RESEND_API_KEY not set — skipping capture email")
      } else {
        try {
          if (!resendClient) {
            resendClient = new Resend(process.env.RESEND_API_KEY)
          }
          const { data: userData, error: userError } =
            await supabase.auth.admin.getUserById(item.user_id)

          if (userError || !userData?.user?.email) {
            throw new Error(userError?.message || `Missing email for user ${item.user_id}`)
          }

          const userEmail = userData.user.email
          const captureHostname = new URL(item.url).hostname

          const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#6A11CB,#FF7A00);display:inline-block;padding:12px 28px;border-radius:12px;">
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Timedshot</span>
    </div>
  </div>
  <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111;">Your capture is ready 📄</h2>
  <p style="font-size:15px;color:#555;margin-bottom:12px;">
    We successfully captured <a href="${item.url}" style="color:#6A11CB;">${item.url}</a>.
  </p>
  <p style="font-size:15px;color:#555;margin-bottom:20px;">
    Capture completed at <strong>${captureTimestamp}</strong> (America/Edmonton).
  </p>
  <p style="font-size:15px;color:#555;margin-bottom:28px;">
    Your PDF is attached to this email.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <p style="font-size:12px;color:#aaa;text-align:center;">
    This is an automated message from Timedshot.
  </p>
</div>`

          const { error: emailError } = await resendClient.emails.send({
            from: FROM_EMAIL,
            to: userEmail,
            subject: `📄 Your capture is ready – ${captureHostname}`,
            html,
            attachments: [{ filename: fileName, content: pdfBuffer }],
          })

          if (emailError) {
            throw new Error(emailError.message || JSON.stringify(emailError))
          }

          console.log(`✉️ Capture email sent to ${userEmail}`)
        } catch (emailErr) {
          console.error(`❌ Failed to send capture email: ${emailErr.message}`)
        }
      }

    } catch (err) {
      console.error("❌ Capture failed:", err.message)
      const errorMessage = err.message

      await supabase.from("captures").insert({
        url_id: item.id,
        user_id: item.user_id,
        status: "failed",
        error: errorMessage,
        label: item.label || null,
      })

      await sendFailureEmail(item, errorMessage)
      await handleRetry(item, captureMode)
    }

    // ✅ Always close page and context after each URL
    await page.close()
    await context.close()
  }

  await browser.close()

  console.log("🎉 Worker finished")
}

runWorker()
