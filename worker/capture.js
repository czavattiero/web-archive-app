import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

console.log("🔍 DEBUG START")

// ✅ INIT SUPABASE
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log("SUPABASE_URL:", process.env.SUPABASE_URL)
console.log(
  "SUPABASE_SERVICE_ROLE_KEY EXISTS:",
  !!process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🌎 Alberta time
function getAlbertaTime() {
  return new Date().toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
  })
}

// 🚀 CAPTURE FUNCTION
async function capturePage(browser, url) {
  console.log("➡️ Opening:", url)

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    viewport: { width: 1366, height: 768 },
  })

  const page = await context.newPage()

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })

  console.log("✅ Page loaded")

  await page.waitForTimeout(2000)

  const html = await page.content()

  if (
    html.includes("403") ||
    html.includes("Access Denied") ||
    html.includes("captcha")
  ) {
    throw new Error("Blocked page")
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

  console.log("✅ PDF generated")

  return pdf
}

// 🏁 MAIN
async function run() {
  console.log("🚀 Worker started")

  // 🚨 FORCE FETCH ALL URLS (NO SCHEDULING FILTER)
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")

  if (error) {
    console.error("❌ URL FETCH ERROR:", error)
    return
  }

  console.log("📦 URLs fetched FULL:", JSON.stringify(urls, null, 2))

  if (!urls || urls.length === 0) {
    console.log("❌ No URLs found at all")
    return
  }

  // 🧪 TEST INSERT (CRITICAL DEBUG)
  const { error: testInsertError } = await supabase.from("captures").insert({
    url_id: urls[0].id,
    file_path: "test.pdf",
    status: "test",
    created_at: new Date().toISOString(),
  })

  if (testInsertError) {
    console.error("❌ TEST INSERT FAILED:", testInsertError)
  } else {
    console.log("🧪 TEST INSERT SUCCESS")
  }

  // 🚀 Launch browser ONCE
  const browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log("🌐 Processing:", url)

    let pdfBuffer = null
    let status = "success"
    let errorMsg = null
    let fileName = null

    try {
      pdfBuffer = await capturePage(browser, url)
    } catch (err) {
      console.error("❌ Capture failed:", err.message)
      status = "failed"
      errorMsg = err.message
    }

    // 💾 Upload if success
    if (pdfBuffer) {
      fileName = `${id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.error("❌ Upload failed:", uploadError)
        status = "failed"
        errorMsg = uploadError.message
      } else {
        console.log("✅ Upload success:", fileName)
      }
    }

    // 🧠 ALWAYS INSERT RECORD
    const { error: insertError } = await supabase.from("captures").insert({
      url_id: id,
      file_path: fileName,
      status,
      error: errorMsg,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("❌ FINAL INSERT FAILED:", insertError)
    } else {
      console.log("✅ DB INSERT SUCCESS")
    }
  }

  await browser.close()

  console.log("🏁 Worker finished")
}

run()
