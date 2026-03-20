import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CONCURRENCY = 3

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

async function createContext(browser) {
  return await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    timezoneId: "America/Edmonton",
  })
}

async function capturePage(browser, url) {
  const context = await createContext(browser)
  const page = await context.newPage()

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    })
  })

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  await page.waitForTimeout(2000)

  const html = await page.content()

  if (
    html.includes("403") ||
    html.includes("captcha") ||
    html.includes("Cloudflare")
  ) {
    throw new Error("Blocked")
  }

  const timestamp = getAlbertaTime()

  await page.evaluate((timestamp) => {
    const banner = document.createElement("div")
    banner.innerText = `Captured: ${timestamp}`
    banner.style.background = "white"
    banner.style.color = "black"
    banner.style.padding = "10px"
    document.body.prepend(banner)
  }, timestamp)

  const pdf = await page.pdf({ format: "A4" })

  await context.close()

  return pdf
}

// 🔥 SAFE PROCESS FUNCTION (NEVER CRASHES)
async function processUrl(urlRecord, browser, proxyBrowser) {
  const { id, url } = urlRecord

  console.log("🌐 Processing:", url)

  let pdfBuffer = null
  let status = "success"
  let errorMsg = null
  let fileName = null

  try {
    // attempt 1
    try {
      pdfBuffer = await capturePage(browser, url)
      console.log("✅ Direct success")
    } catch (err) {
      console.log("❌ Direct failed:", err.message)

      if (proxyBrowser) {
        try {
          pdfBuffer = await capturePage(proxyBrowser, url)
          console.log("✅ Proxy success")
        } catch (err2) {
          status = "failed"
          errorMsg = err2.message
        }
      } else {
        status = "failed"
        errorMsg = err.message
      }
    }

    // upload
    if (pdfBuffer) {
      fileName = `${id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (uploadError) {
        console.log("❌ Upload error:", uploadError.message)
        status = "failed"
        errorMsg = uploadError.message
      } else {
        console.log("✅ Uploaded:", fileName)
      }
    }

    // ALWAYS insert (THIS FIXES YOUR ISSUE)
    const { error: insertError } = await supabase.from("captures").insert({
      url_id: id,
      file_path: fileName,
      status,
      error: errorMsg,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.log("❌ INSERT ERROR:", insertError)
    } else {
      console.log("✅ DB insert OK")
    }

    // update schedule
    const next = getNextCaptureTime(urlRecord)

    await supabase
      .from("urls")
      .update({ next_capture_at: next.toISOString() })
      .eq("id", id)

  } catch (fatal) {
    console.log("🔥 FATAL ERROR:", fatal.message)
  }
}

async function run() {
  console.log("🚀 Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (error) {
    console.log("❌ DB ERROR:", error)
    return
  }

  console.log("📦 URLs:", urls?.length)

  if (!urls || urls.length === 0) return

  const browser = await chromium.launch({ headless: true })

  const proxyBrowser = proxy
    ? await chromium.launch({ headless: true, proxy })
    : null

  // 🔥 SAFE PARALLEL (NO CRASH)
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const chunk = urls.slice(i, i + CONCURRENCY)

    await Promise.allSettled(
      chunk.map((u) => processUrl(u, browser, proxyBrowser))
    )
  }

  await browser.close()
  if (proxyBrowser) await proxyBrowser.close()

  console.log("🏁 Worker finished")
}

run()
