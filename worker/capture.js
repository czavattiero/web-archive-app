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

async function capturePage(browser, url) {
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(2000)

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

  const { data: urls } = await supabase.from("urls").select("*")

  console.log("📦 URLs:", urls?.length)

  if (!urls || urls.length === 0) return

  const browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {
    const { id, url } = urlRecord

    console.log("🌐 Processing:", url)

    let fileName = null

    try {
      const pdfBuffer = await capturePage(browser, url)

      fileName = `${id}-${Date.now()}.pdf`

      // ✅ UPLOAD
      const { data, error } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (error) {
        console.error("❌ Upload error:", error)
        throw error
      }

      console.log("✅ Uploaded:", fileName)

      // ✅ VERIFY FILE EXISTS (IMPORTANT)
      const { data: publicUrlData } = supabase.storage
        .from("captures")
        .getPublicUrl(fileName)

      console.log("🔗 Public URL:", publicUrlData.publicUrl)

      // ✅ INSERT DB
      await supabase.from("captures").insert({
        url_id: id,
        file_path: fileName,
        status: "success",
        created_at: new Date().toISOString(),
      })

    } catch (err) {
      console.error("❌ Capture failed:", err.message)

      await supabase.from("captures").insert({
        url_id: id,
        file_path: fileName,
        status: "failed",
        error: err.message,
        created_at: new Date().toISOString(),
      })
    }
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
