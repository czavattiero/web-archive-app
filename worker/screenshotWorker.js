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

    console.log("Preparing capture:", url.url)

    try {

      // STEP 1 — Immediately update next_capture_at
      await supabase
        .from("urls")
        .update({
          next_capture_at: new Date(Date.now() + 86400000)
        })
        .eq("id", url.id)

      console.log("Locked URL for capture")

      // STEP 2 — Launch browser
      const browser = await chromium.launch()

      const page = await browser.newPage()

      await page.goto(url.url, {
        waitUntil: "networkidle",
        timeout: 60000
      })

      // STEP 3 — Generate PDF
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

    } catch (err) {

      console.error("Capture failed:", err)

    }

  }

  console.log("Worker finished")

}

runWorker()
