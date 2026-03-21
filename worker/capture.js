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

async function waitForRealPage(page) {
  console.log("⏳ Waiting for Cloudflare...")

  for (let i = 0; i < 6; i++) {
    const html = await page.content()

    if (
      !html.includes("security verification") &&
      !html.includes("Just a moment") &&
      !html.includes("Cloudflare")
    ) {
      console.log("✅ Passed Cloudflare")
      return true
    }

    await page.waitForTimeout(3000)
  }

  return false
}

async function capturePage(browser, url) {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    timezoneId: "America/Edmonton",
    locale: "en-US",
  })

  const page = await context.newPage()

  // stealth tweak
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => false,
    })
  })

  console.log("🌐 Opening:", url)

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  // simulate human behavior
  await page.mouse.move(100, 200)
  await page.waitForTimeout(2000)

  const passed = await waitForRealPage(page)

  if (!passed) {
    throw new Error("Cloudflare block")
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

  if (!urls || urls.length === 0) {
    console.log("✅ No URLs to process")
    return
  }

  console.log("📦 Processing:", urls.length)

  const browser = await chromium.launch({
    headless: true, // ✅ REQUIRED for GitHub
  })

  for (const u of urls) {
    let pdf = null
    let status = "success"
    let errorMsg = null
    let fileName = null

    try {
      pdf = await capturePage(browser, u.url)
    } catch (err) {
      console.log("❌ Capture failed:", err.message)
      status = "failed"
      errorMsg = err.message
    }

    if (pdf) {
      fileName = `${u.id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdf, {
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

    await supabase.from("captures").insert({
      url_id: u.id,
      file_path: fileName,
      status,
      error: errorMsg,
      created_at: new Date().toISOString(),
    })

    await supabase
      .from("urls")
      .update({
        next_capture_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .eq("id", u.id)
  }

  await browser.close()

  console.log("🏁 Worker finished")
}

run()
