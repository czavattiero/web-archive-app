import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function capturePage(page, url) {
  try {
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 60000
    })

    // Allow potential bot challenges to complete
    await page.waitForTimeout(5000)

    return true
  } catch (err) {
    console.error("Navigation failed:", err)
    return false
  }
}

async function runWorker() {

  console.log("Worker started")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")
    .lte("next_capture_at", new Date().toISOString())
    .limit(3)

  if (error) {
    console.error("Error loading URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs to capture")
    return
  }

  for (const url of urls) {

    try {

      console.log("Capturing:", url.url)

      await supabase
        .from("urls")
        .update({
          next_capture_at: new Date(Date.now() + 86400000)
        })
        .eq("id", url.id)

      const browser = await chromium.launch({
        headless: true
      })

      const context = await browser.newContext({

        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",

        viewport: { width: 1280, height: 1600 },

        locale: "en-US",

        extraHTTPHeaders: {
          "accept-language": "en-US,en;q=0.9"
        }
      })

      const page = await context.newPage()

      // Hide automation flag
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => false
        })
      })

      const loaded = await capturePage(page, url.url)

      if (!loaded) {
        await browser.close()
        continue
      }

      const timestamp = new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", " UTC")

      const captureId = Date.now()

      // Insert timestamp banner
      await page.evaluate((timestamp, pageUrl, captureId) => {

        const banner = document.createElement("div")

        banner.innerHTML = `
          <div><b>Captured:</b> ${timestamp}</div>
          <div><b>URL:</b> ${pageUrl}</div>
          <div><b>System:</b> WebArchive</div>
          <div><b>Capture ID:</b> ${captureId}</div>
        `

        banner.style.background = "white"
        banner.style.color = "black"
        banner.style.fontFamily = "Arial"
        banner.style.fontSize = "14px"
        banner.style.padding = "10px"
        banner.style.borderBottom = "2px solid black"

        document.body.prepend(banner)

      }, timestamp, url.url, captureId)

      await page.waitForTimeout(2000)

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true
      })

      await browser.close()

      const fileName = `${url.id}-${Date.now()}.pdf`

      console.log("Uploading:", fileName)

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf"
        })

      if (uploadError) {
        console.error("Upload failed:", uploadError)
        continue
      }

      await supabase
        .from("captures")
        .insert({
          url_id: url.id,
          file_path: fileName
        })

      console.log("Capture stored")

    } catch (err) {

      console.error("Capture failed:", err)

    }

  }

}

runWorker()
