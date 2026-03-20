import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

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

// 🌐 Proxy (Webshare)
const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

// 🧠 Human-like browser
async function createContext(browser) {
  return await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "en-US",
    timezoneId: "America/Edmonton",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  })
}

// 🚀 Capture
async function capturePage(browser, url) {
  const context = await createContext(browser)
  const page = await context.newPage()

  // stealth tweak
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    })
  })

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  // simulate human behavior
  await page.mouse.move(100, 200)
  await page.waitForTimeout(3000)

  const html = await page.content()

  if (
    html.includes("403") ||
    html.includes("Access Denied") ||
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
    banner.style.textAlign = "center"
    document.body.prepend(banner)
  }, timestamp)

  const pdf = await page.pdf({ format: "A4" })

  await context.close()

  return pdf
}

// 🏁 MAIN
async function run() {
  console.log("🚀 Worker started")

  // ✅ ONLY PROCESS DUE URLS
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (error) {
    console.error("❌ DB error:", error)
    return
  }

  console.log("📦 URLs to process:", urls?.length)

  if (!urls || urls.length === 0) {
    console.log("✅ Nothing to run")
    return
  }

  const browser = await chromium.launch({ headless: true })

  const proxyBrowser = proxy
    ? await chromium.launch({ headless: true, proxy })
    : null

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log("🌐 Processing:", url)

    // 🛡 prevent re-running immediately
    const { data: lastCapture } = await supabase
      .from("captures")
      .select("created_at")
      .eq("url_id", id)
      .order("created_at", { ascending: false })
      .limit(1)

    if (lastCapture?.length) {
      const lastTime = new Date(lastCapture[0].created_at).getTime()
      const diffSeconds = (Date.now() - lastTime) / 1000

      if (diffSeconds < 30) {
        console.log("⏭ Skipping (just captured)")
        continue
      }
    }

    let pdfBuffer = null
    let status = "success"
    let errorMsg = null
    let fileName = null

    // 🥇 Try without proxy
    try {
      pdfBuffer = await capturePage(browser, url)
      console.log("✅ Success (direct)")
    } catch (err) {
      console.log("❌ Direct failed:", err.message)
    }

    // 🥈 Retry with proxy
    if (!pdfBuffer && proxyBrowser) {
      try {
        pdfBuffer = await capturePage(proxyBrowser, url)
        console.log("✅ Success (proxy)")
      } catch (err) {
        console.log("❌ Proxy failed:", err.message)
        status = "failed"
        errorMsg = err.message
      }
    }

    if (pdfBuffer) {
      fileName = `${id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)
        status = "failed"
        errorMsg = uploadError.message
      } else {
        console.log("✅ Uploaded:", fileName)
      }
    }

    await supabase.from("captures").insert({
      url_id: id,
      file_path: fileName,
      status,
      error: errorMsg,
      created_at: new Date().toISOString(),
    })

    // ✅ UPDATE NEXT RUN (THIS FIXES YOUR MAIN ISSUE)
    const next = getNextCaptureTime(urlRecord)

    await supabase
      .from("urls")
      .update({
        next_capture_at: next.toISOString(),
      })
      .eq("id", id)

    console.log("⏱ Next capture:", next)
  }

  await browser.close()
  if (proxyBrowser) await proxyBrowser.close()

  console.log("🏁 Worker finished")
}

run()
