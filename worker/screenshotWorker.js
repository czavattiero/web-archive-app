import dotenv from "dotenv"
dotenv.config()

import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import fs from "fs"
import path from "path"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {

  console.log("Starting capture worker...")

  const now = new Date().toISOString()

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture", now)

  if (error) {
    console.error("Error loading URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs ready for capture.")
    return
  }

  console.log(`Found ${urls.length} URLs to capture`)

  const browser = await chromium.launch({ headless: true })

  for (const urlRecord of urls) {

    const url = urlRecord.url

    try {

      console.log("Capturing:", url)

      const page = await browser.newPage()

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 60000
      })

      const timestamp = new Date().toLocaleString("en-CA", {
        timeZone: "America/Edmonton"
      })

      await page.evaluate((timestamp) => {

        const banner = document.createElement("div")

        banner.innerText = "Captured: " + timestamp

        banner.style.position = "fixed"
        banner.style.top = "0"
        banner.style.left = "0"
        banner.style.width = "100%"
        banner.style.background = "white"
        banner.style.color = "black"
        banner.style.padding = "6px"
        banner.style.fontSize = "12px"
        banner.style.zIndex = "999999"

        document.body.prepend(banner)

      }, timestamp)

      const fileName = `capture-${urlRecord.id}-${Date.now()}.pdf`
      const filePath = path.join("screenshots", fileName)

      await page.pdf({
        path: filePath,
        format: "A4",
        printBackground: true
      })

      await page.close()

      const fileBuffer = fs.readFileSync(filePath)

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf"
        })

      if (uploadError) {
        console.error("Upload failed:", uploadError)
        continue
      }

      const { error: insertError } = await supabase
        .from("captures")
        .insert({
          url_id: urlRecord.id,
          file_path: fileName,
          captured_at: new Date(),
          status: "success"
        })

      if (insertError) {
        console.error("Database insert failed:", insertError)
      }

      const nextCapture = new Date()

      if (urlRecord.schedule_type === "weekly") {
        nextCapture.setDate(nextCapture.getDate() + 7)
      }

      if (urlRecord.schedule_type === "biweekly") {
        nextCapture.setDate(nextCapture.getDate() + 14)
      }

      if (urlRecord.schedule_type === "29 days") {
        nextCapture.setDate(nextCapture.getDate() + 29)
      }

      if (urlRecord.schedule_type === "30 days") {
        nextCapture.setDate(nextCapture.getDate() + 30)
      }

      await supabase
        .from("urls")
        .update({ next_capture: nextCapture })
        .eq("id", urlRecord.id)

      fs.unlinkSync(filePath)

      console.log("Capture stored successfully")

    } catch (err) {

      console.error("Capture failed:", err)

      await supabase
        .from("captures")
        .insert({
          url_id: urlRecord.id,
          captured_at: new Date(),
          status: "failed"
        })

    }

  }

  await browser.close()

  console.log("Worker finished")

}

run()
