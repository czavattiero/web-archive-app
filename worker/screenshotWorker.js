import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runWorker() {

  console.log("Worker started")

  const browser = await chromium.launch({
    headless: true
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 1600 },
    locale: "en-US"
  })

  while (true) {

    const { data: urls, error } = await supabase
      .from("urls")
      .select("*")
      .eq("status", "active")
      .or(`next_capture_at.lte.${new Date().toISOString()},next_capture_at.is.null`)
      .limit(3)

    if (error) {
      console.error("Error loading URLs:", error)
      await new Promise(r => setTimeout(r, 5000))
      continue
    }

    if (!urls || urls.length === 0) {
      console.log("No URLs to capture")
      await new Promise(r => setTimeout(r, 10000))
      continue
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

        const page = await context.newPage()

        await page.setExtraHTTPHeaders({
          "accept-language": "en-US,en;q=0.9"
        })

        await page.goto(url.url, {
          waitUntil: "networkidle",
          timeout: 60000
        })

        await page.waitForTimeout(4000)

        const timestamp = new Date()
          .toISOString()
          .replace("T"," ")
          .replace("Z"," UTC")

        const captureId = Date.now()

        // Inject timestamp banner inside the page
        await page.evaluate(({ timestamp, url, captureId }) => {

          const banner = document.createElement("div")

          banner.style.width = "100%"
          banner.style.background = "white"
          banner.style.color = "black"
          banner.style.fontFamily = "Arial, sans-serif"
          banner.style.fontSize = "14px"
          banner.style.padding = "12px"
          banner.style.borderBottom = "2px solid black"
          banner.style.lineHeight = "1.6"
          banner.style.position = "relative"
          banner.style.zIndex = "999999"

          banner.innerHTML = `
            <div><strong>Captured:</strong> ${timestamp}</div>
            <div><strong>URL:</strong> ${url}</div>
            <div><strong>System:</strong> WebArchive</div>
            <div><strong>Capture ID:</strong> ${captureId}</div>
          `

          const spacer = document.createElement("div")
          spacer.style.height = "120px"

          document.body.prepend(spacer)
          document.body.prepend(banner)

        }, { timestamp, url: url.url, captureId })

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          margin: {
            top: "40px",
            bottom: "40px",
            left: "20px",
            right: "20px"
          }
        })

        await page.close()

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

      }

      catch(err) {

        console.error("Capture failed:", err)

      }

    }

  }

}

runWorker()
