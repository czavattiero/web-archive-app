import "dotenv/config"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runWorker() {

  console.log("Worker started")

  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: `http://${process.env.SMARTPROXY_HOST}:${process.env.SMARTPROXY_PORT}`,
      username: process.env.SMARTPROXY_USER,
      password: process.env.SMARTPROXY_PASS
    }
  })

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 1600 },
    locale: "en-US"
  })

  for (let cycle = 0; cycle < 20; cycle++) {

    const { data: urls, error } = await supabase
      .from("urls")
      .select("*")
      .eq("status", "active")
      .or(`next_capture_at.lte.${new Date().toISOString()},next_capture_at.is.null`)
      .limit(3)

    if (error) {
      console.error(error)
      continue
    }

    if (!urls || urls.length === 0) {
      console.log("No scheduled captures")
      await new Promise(r => setTimeout(r, 10000))
      continue
    }

    for (const url of urls) {

      try {

        console.log("Capturing:", url.url)

        const page = await context.newPage()

        await page.goto(url.url, {
          waitUntil: "networkidle",
          timeout: 60000
        })

        await page.waitForTimeout(4000)

        const timestamp = new Date()
          .toISOString()
          .replace("T"," ")
          .replace("Z"," UTC")

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: `
            <div style="font-size:10px;width:100%;padding:5px 20px;font-family:Arial;">
            Captured: ${timestamp} | ${url.url} | WebArchive
            </div>
          `,
          footerTemplate: `
            <div style="font-size:9px;width:100%;text-align:center;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
          `,
          margin: {
            top: "80px",
            bottom: "60px",
            left: "20px",
            right: "20px"
          }
        })

        await page.close()

        const fileName = `${url.id}-${Date.now()}.pdf`

        await supabase.storage
          .from("captures")
          .upload(fileName, pdfBuffer, {
            contentType: "application/pdf"
          })

        await supabase
          .from("captures")
          .insert({
            url_id: url.id,
            file_path: fileName
          })

        console.log("Capture stored")

        // ---------- SCHEDULING ----------

        const baseTime = new Date(url.next_capture_at || Date.now())
        let nextCapture

        switch (url.schedule_type) {

          case "weekly":
            nextCapture = new Date(baseTime.getTime() + 7 * 86400000)
            break

          case "biweekly":
            nextCapture = new Date(baseTime.getTime() + 14 * 86400000)
            break

          case "29days":
            nextCapture = new Date(baseTime.getTime() + 29 * 86400000)
            break

          case "30days":
            nextCapture = new Date(baseTime.getTime() + 30 * 86400000)
            break

          case "custom":
            nextCapture = new Date(
              baseTime.getTime() + (url.schedule_value || 7) * 86400000
            )
            break

          case "specific":
            nextCapture = new Date(url.schedule_value)
            break

          default:
            nextCapture = new Date(baseTime.getTime() + 7 * 86400000)

        }

        await supabase
          .from("urls")
          .update({
            next_capture_at: nextCapture
          })
          .eq("id", url.id)

        console.log("Next capture scheduled:", nextCapture)

      }

      catch (err) {

        console.error("Capture failed:", err)

      }

    }

  }

  await browser.close()
}

runWorker()
