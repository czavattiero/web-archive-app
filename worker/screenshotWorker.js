import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runWorker() {

  console.log("Worker started")

  const { data: urls } = await supabase
    .from("urls")
    .select("*")
    .limit(3)

  if (!urls || urls.length === 0) return

  for (const url of urls) {

    try {

      const browser = await chromium.launch()

      const context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
        viewport: { width: 1280, height: 1600 }
      })

      const page = await context.newPage()

      await page.goto(url.url, {
        waitUntil: "networkidle",
        timeout: 60000
      })

      await page.waitForTimeout(4000)

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true
      })

      await browser.close()

      // Load PDF to add timestamp
      const pdfDoc = await PDFDocument.load(pdfBuffer)

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

      const pages = pdfDoc.getPages()

      const timestamp = new Date().toISOString()

      const captureText =
        `Captured: ${timestamp}\n` +
        `URL: ${url.url}\n` +
        `System: WebArchive\n` +
        `Capture ID: ${Date.now()}`

      pages.forEach(page => {

        page.drawRectangle({
          x: 0,
          y: page.getHeight() - 60,
          width: page.getWidth(),
          height: 60,
          color: rgb(1,1,1)
        })

        page.drawText(captureText, {
          x: 20,
          y: page.getHeight() - 50,
          size: 10,
          font,
          color: rgb(0,0,0)
        })

      })

      const finalPdf = await pdfDoc.save()

      const fileName = `${url.id}-${Date.now()}.pdf`

      await supabase.storage
        .from("captures")
        .upload(fileName, finalPdf, {
          contentType: "application/pdf"
        })

      await supabase
        .from("captures")
        .insert({
          url_id: url.id,
          file_path: fileName
        })

      console.log("Capture stored")

    }

    catch(err) {
      console.error(err)
    }

  }

}

runWorker()
