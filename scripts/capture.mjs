process.env.TZ = "America/Edmonton"

import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

console.log("Capture engine started")

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const bucket = "captures"

async function runCapture() {

  console.log("Connecting to database...")

  const { data: urls, error } = await supabase
  .from("screenshot_jobs")
  .select("*")

  if (error) {
    console.log("Database error:", error)
    return
  }

  console.log("URLs found:", urls.length)

  if (!urls || urls.length === 0) {
    console.log("No URLs in database")
    return
  }

  const now = new Date()

  const ready = urls.filter(u => new Date(u.next_capture_at) <= now)

  console.log("URLs ready for capture:", ready.length)

  if (ready.length === 0) {
    console.log("No captures scheduled")
    return
  }

  for (const item of ready) {

    console.log("Capturing:", item.url)

    try {

      const browser = await chromium.launch()
      const page = await browser.newPage()

      await page.goto(item.url, { waitUntil: "networkidle" })

      const timestamp = new Date().toLocaleString("en-CA", {
  timeZone: "America/Edmonton"
})

      await page.addStyleTag({
        content: `
        #screenly-timestamp {
          position: fixed;
          top: 0;
          width: 100%;
          background: white;
          color: black;
          padding: 5px;
          text-align: center;
          z-index: 999999;
        }
        body { margin-top: 30px; }
        `
      })

      await page.evaluate((timestamp) => {
        const div = document.createElement("div")
        div.id = "screenly-timestamp"
        div.innerText = "Captured: " + timestamp
        document.body.prepend(div)
      }, timestamp)

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true
      })

      const fileName = `${item.id}-${Date.now()}.pdf`

      console.log("Uploading file:", fileName)

      const { data: uploadData, error: uploadError } = await supabase.storage
  .from("captures")
  .upload(fileName, pdf, {
    contentType: "application/pdf",
    upsert: true
  })

if (uploadError) {
  console.log("UPLOAD ERROR:", uploadError)
} else {
  console.log("UPLOAD SUCCESS:", uploadData)
}

      if (uploadError) {
        console.log("Upload error:", uploadError)
      }

      const { error: insertError } = await supabase
        .from("captures")
        .insert({
          url_id: item.id,
          file_path: fileName,
          status: "success"
        })

      if (insertError) {
        console.log("Insert error:", insertError)
      }

      await browser.close()

      console.log("Capture completed")

    } catch (err) {

      console.log("Capture failed:", err)

      await supabase
        .from("captures")
        .insert({
          url_id: item.id,
          status: "failed"
        })

    }

  }

}

runCapture()
