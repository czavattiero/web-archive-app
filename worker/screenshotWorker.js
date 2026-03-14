import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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

      // update next capture time
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
        locale: "en-US"
      })

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

      const headerHtml = `
      <div style="
        width:100%;
        font-family:Arial, sans-serif;
        font-size:12px;
        padding:8px 20px;
        background:white;
        color:black;
        border-bottom:1px solid black;
      ">
        <div><b>Captured:</b> ${timestamp}</div>
        <div><b>URL:</b> ${url.url}</div>
        <div><b>System:</b> WebArchive</div>
        <div><b>Capture ID:</b> ${captureId}</div>
      </div>
      `

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,

        margin: {
          top: "120px",
          bottom: "40px",
          left: "20px",
          right: "20px"
        },

        headerTemplate: headerHtml,

        footerTemplate: `
        <div style="
          font-size:10px;
          width:100%;
          text-align:center;
          color:#666;
        ">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
        `
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
