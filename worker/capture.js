import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

console.log("🔍 DEBUG START")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🌎 Alberta time
function getAlbertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
  })
}

// ⏱ schedule logic
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

// 🌐 Webshare proxy
const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

// 🧠 Human-like context
async function createContext(browser) {
  return await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/Edmonton",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
}

// 🚀 Capture function
async function capturePage(browser, url) {
  const context = await createContext(browser)
  const page = await context.newPage()

  // Hide automation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    })
  })

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  await page.waitForTimeout(2000) // faster

  const content = await page.content()

  // 🚨 Block detection
  if (
    content.includes("403") ||
    content.includes("Access Denied") ||
    content.includes("captcha") ||
    content.includes("Cloudflare")
  ) {
    throw new Error("Blocked")
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

  const pdf = await page.pdf({ format: "A4" })

  await context.close()

  return pdf
}

// 🏁 MAIN WORKER
async function run() {
  console.log("🚀 Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (error) {
    console.error("❌ DB error:", error)
    return
  }

  console.log("📦 URLs fetched:", urls?.length)

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  // 🚀 LAUNCH BROWSERS ONCE (BIG SPEED BOOST)
  const browser = await chromium.launch({ headless: true })

  const proxyBrowser = proxy
    ? await chromium.launch({ headless: true, proxy })
    : null

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log("🌐 Processing:", url)

    // 🛡 duplicate protection
    const { data: existing } = await supabase
      .from("captures")
      .select("created_at")
      .eq("url_id", id)
      .order("created_at", { ascending: false })
      .limit(1)

    if (existing?.length) {
      const last = new Date(existing[0].created_at).getTime()
      if ((Date.now() - last) / 1000 < 60) {
        console.log("⏭ Skipping recent capture")
        continue
      }
    }

    let pdfBuffer = null

    // 🥇 Attempt 1 — fast (no proxy)
    try {
      pdfBuffer = await capturePage(browser, url)
      console.log("✅ Success (no proxy)")
    } catch (err) {
      console.log("❌ Attempt 1 failed:", err.message)
    }

    // 🥈 Attempt 2 — proxy fallback
    if (!pdfBuffer && proxyBrowser) {
      try {
        pdfBuffer = await capturePage(proxyBrowser, url)
        console.log("✅ Success (proxy)")
      } catch (err) {
        console.log("❌ Proxy failed:", err.message)
      }
    }

    // ❌ TOTAL FAILURE
    if (!pdfBuffer) {
      await supabase.from("captures").insert({
        url_id: id,
        status: "failed",
        error: "Blocked",
        created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
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

  // 🧹 CLOSE BROWSERS
  await browser.close()
  if (proxyBrowser) await proxyBrowser.close()

  console.log("🏁 Worker finished")
}

run()
