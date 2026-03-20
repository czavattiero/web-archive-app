import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

console.log("🔍 DEBUG START")

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
  return new Date(now + 7 * 24 * 60 * 60 * 1000)
}

const proxy = process.env.PROXY_HOST
  ? {
      server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
      username: process.env.PROXY_USERNAME,
      password: process.env.PROXY_PASSWORD,
    }
  : null

async function capturePage(browser, url) {
  console.log("➡️ Opening page...")

  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  console.log("✅ Page loaded")

  await page.waitForTimeout(3000)

  const html = await page.content()

  if (html.includes("403") || html.includes("captcha")) {
    throw new Error("Blocked page detected")
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

  console.log("✅ PDF generated")

  return pdf
}

async function run() {
  console.log("🚀 Worker started")

  const { data: urls } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  console.log("📦 URLs fetched:", urls?.length)

  if (!urls || urls.length === 0) return

  const browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log("🌐 Processing:", url)

    let pdfBuffer = null
    let status = "success"
    let errorMsg = null

    try {
      pdfBuffer = await capturePage(browser, url)
    } catch (err) {
      console.log("❌ Capture failed:", err.message)
      status = "failed"
      errorMsg = err.message
    }

    // 💾 SAVE FILE (only if success)
    let fileName = null

    if (pdfBuffer) {
      fileName = `${id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.log("❌ Upload failed:", uploadError.message)
        status = "failed"
        errorMsg = uploadError.message
      } else {
        console.log("✅ Upload success")
      }
    }

    // 🧠 ALWAYS INSERT (THIS IS KEY)
    const { error: insertError } = await supabase.from("captures").insert({
      url_id: id,
      file_path: fileName,
      status,
      error: errorMsg,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.log("❌ INSERT FAILED:", insertError)
    } else {
      console.log("✅ DB insert success")
    }

    // ⏱ update next run
    await supabase
      .from("urls")
      .update({
        next_capture_at: getNextCaptureTime(urlRecord).toISOString(),
      })
      .eq("id", id)
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
