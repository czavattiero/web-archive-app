import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🌎 Alberta Time
function getAlbertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
  })
}

// ⏱ Schedule logic
function getNextCaptureTime(urlRecord) {
  const now = Date.now()

  switch (urlRecord.schedule_type) {
    case "weekly":
      return new Date(now + 7 * 24 * 60 * 60 * 1000)
    case "biweekly":
      return new Date(now + 14 * 24 * 60 * 60 * 1000)
    case "monthly_29":
      return new Date(now + 29 * 24 * 60 * 60 * 1000)
    case "monthly_30":
      return new Date(now + 30 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now + 15 * 60 * 1000)
  }
}

// 🌐 Proxy (optional)
const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

// 🚀 Capture logic
async function capturePage(browser, url, useProxy = false) {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
  })

  const page = await context.newPage()

  console.log(`🌐 Loading: ${url} (proxy: ${useProxy})`)

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  await page.waitForTimeout(5000)

  const content = await page.content()

  // 🚨 Detect blocking (BUT DO NOT STOP — we still save for debugging)
  let blocked = false

  if (
    content.includes("403 Forbidden") ||
    content.includes("Access Denied") ||
    content.includes("captcha")
  ) {
    console.log("⚠️ Block detected")
    blocked = true
  }

  // 🕒 Add timestamp safely (no overlap)
  const timestamp = getAlbertaTime()

  await page.evaluate((timestamp) => {
    const banner = document.createElement("div")
    banner.innerText = `Captured: ${timestamp}`

    banner.style.width = "100%"
    banner.style.padding = "10px"
    banner.style.background = "white"
    banner.style.color = "black"
    banner.style.textAlign = "center"
    banner.style.fontSize = "12px"
    banner.style.position = "relative"

    document.body.insertBefore(banner, document.body.firstChild)
    document.body.style.marginTop = "20px"
  }, timestamp)

  const pdfBuffer = await page.pdf({ format: "A4" })

  await context.close()

  return { pdfBuffer, blocked }
}

async function run() {
  console.log("🚀 Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (error) {
    console.log("❌ DB error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  const browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log(`🔎 Processing: ${url}`)

    // 🚫 PREVENT DUPLICATE CAPTURES
    const { data: existing } = await supabase
      .from("captures")
      .select("created_at")
      .eq("url_id", id)
      .order("created_at", { ascending: false })
      .limit(1)

    if (existing && existing.length > 0) {
      const lastTime = new Date(existing[0].created_at).getTime()
      const diffMinutes = (Date.now() - lastTime) / (1000 * 60)

      if (diffMinutes < 10) {
        console.log("⏭ Skipping — recently captured")
        continue
      }
    }

    let result = null

    try {
      result = await capturePage(browser, url, false)
    } catch (err) {
      console.log("❌ First attempt failed:", err.message)

      if (proxy) {
        console.log("🌐 Retrying with proxy...")

        const proxyBrowser = await chromium.launch({
          headless: true,
          proxy,
        })

        try {
          result = await capturePage(proxyBrowser, url, true)
        } catch (err2) {
          console.log("❌ Proxy attempt failed:", err2.message)
        }

        await proxyBrowser.close()
      }
    }

    if (!result) {
      console.log("❌ Capture failed completely")

      await supabase.from("captures").insert({
        url_id: id,
        status: "failed",
        error: "Capture failed",
      })

      continue
    }

    const { pdfBuffer, blocked } = result

    const fileName = `${id}-${Date.now()}.pdf`

    const { error: uploadError } = await supabase.storage
      .from("captures")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
      })

    if (uploadError) {
      console.log("❌ Upload failed:", uploadError.message)
      continue
    }

    await supabase.from("captures").insert({
      url_id: id,
      file_path: fileName,
      status: blocked ? "blocked" : "success",
    })

    // ⏱ Update next schedule
    const nextCapture = getNextCaptureTime(urlRecord)

    await supabase
      .from("urls")
      .update({
        next_capture_at: nextCapture.toISOString(),
      })
      .eq("id", id)

    console.log("✅ Capture saved")
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
