import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runWorker() {

  console.log("Capture worker started")

  while (true) {

    try {

      const { data: urls } = await supabase
        .from("urls")
        .select("*")
        .lte("next_capture_at", new Date().toISOString())
        .limit(3)

      if (error) {
        console.error("Error loading URLs:", error)
        await sleep(3000)
        continue
      }

      if (!urls || urls.length === 0) {

        await sleep(3000)
        continue

      }

      for (const url of urls) {

        console.log("Capturing:", url.url)

        try {

          const browser = await chromium.launch()

          const page = await browser.newPage()

          await page.goto(url.url, {
            waitUntil: "networkidle",
            timeout: 60000
          })

          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true
          })

          await browser.close()

          const fileName = `${url.id}-${Date.now()}-${Math.random()}.pdf`

          console.log("Uploading PDF:", fileName)

          const { error: uploadError } = await supabase.storage
            .from("captures")
            .upload(fileName, pdfBuffer, {
              contentType: "application/pdf"
            })

          if (uploadError) {

            console.error("Upload failed:", uploadError)

            continue

          }

          console.log("Upload successful")

          const { error: insertError } = await supabase
            .from("captures")
            .insert({
              url_id: url.id,
              file_path: fileName
            })

          if (insertError) {

            console.error("Database insert failed:", insertError)

          } else {

            console.log("Capture record inserted")

          }

          await supabase
            .from("urls")
            .update({
              next_capture_at: new Date(Date.now() + 86400000)
            })
            .eq("id", url.id)

        } catch (captureError) {

          console.error("Capture failed:", captureError)

        }

      }

    } catch (err) {

      console.error("Worker loop error:", err)

    }

  }

}

runWorker()
