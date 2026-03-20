import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function getAlbertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
  })
}

function getNextCaptureTime(urlRecord) {
  const now = Date.now()

  switch (urlRecord.schedule_type) {
    case "weekly":
      return new Date(now + 7 * 24 * 60 * 60 * 1000)
    case "biweekly":
      return new Date(now + 14 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now + 15 * 60 * 1000)
  }
}

const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

async function capturePage(browser, url, id, useProxy = false) {
  const context = await browser.newContext()
  const page = await context.newPage()

  console.log(`🌐 Loading: ${url} (proxy: ${useProxy})`)

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  await page.waitForTimeout(5000)

  const content = await page.content()

  // 🚨 BLOCK DETECTION
  if (
    content.includes("403 Forbidden") ||
    content.includes("Access Denied") ||
    content.includes("captcha")
  ) {
    throw new Error("Blocked (403 / captcha)")
  }

  const timestamp = getAlbertaTime()

  await page.evaluate((timestamp) => {
    const banner = document.createElement("div")
    banner.innerText = `Captured: ${timestamp}`

    banner.style.width = "100%"
    banner.style.padding = "10px"
    banner.style.background = "white"
    banner.style.color = "black"
    banner.style.textAlign = "center"

    document.body.insertBefore(banner, document.body.firstChild)
  }, timestamp)

  const pdfBuffer = await page.pdf({ format: "A4" })

  await context.close()

  return pdfBuffer
}

async function run() {
  console.log("🚀 Worker started")

  const { data: urls } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  let browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    let pdfBuffer = null

    try {
      // 🥇 Attempt 1 (no proxy)
      pdfBuffer = await capturePage(browser, url, id, false)
    } catch (err) {
      console.log("❌ First attempt failed:", err.message)

      if (proxy) {
        console.log("🌐 Retrying with proxy...")

        const proxyBrowser = await chromium.launch({
          headless: true,
          proxy,
        })

        try {
          pdfBuffer = await capturePage(proxyBrowser, url, id, true)
        } catch (err2) {
          console.log("❌ Proxy attempt failed:", err2.message)
        }

        await proxyBrowser.close()
      }
    }

    if (!pdfBuffer) {
      console.log("❌ All attempts failed")

      await supabase.from("captures").insert({
        url_id: id,
        status: "failed",
        error: "Blocked or failed",
      })

      continue
    }

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
      status: "success",
    })

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
