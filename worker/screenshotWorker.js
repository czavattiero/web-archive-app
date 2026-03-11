import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import fs from "fs"
import path from "path"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function calculateNextCapture(schedule) {

  const now = new Date()

  if (schedule === "weekly") now.setDate(now.getDate() + 7)
  if (schedule === "biweekly") now.setDate(now.getDate() + 14)
  if (schedule === "29_days") now.setDate(now.getDate() + 29)
  if (schedule === "30_days") now.setDate(now.getDate() + 30)

  return now
}

async function run() {

  console.log("Worker started")

  const now = new Date().toISOString()

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture", now)

  if (error) {
    console.error(error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs scheduled for capture")
    return
  }

  const browser = await chromium.launch({ headless: true })

  for (const url of urls) {

    try {

      console.log("Capturing:", url.url)

      const context = await browser.newContext({ ignoreHTTPSErrors: true })
      const page = await context.newPage()

      await page.goto(url.url, {
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

      const fileName = `capture-${url.id}-${Date.now()}.pdf`
      const filePath = path.join("screenshots", fileName)

      await page.pdf({
        path: filePath,
        format: "A4",
        printBackground: true
      })

      const fileBuffer = fs.readFileSync(filePath)

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf"
        })

      if (uploadError) {
        console.error("Upload error:", uploadError)
        continue
      }

      await supabase
        .from("captures")
        .insert({
          url_id: url.id,
          file_path: fileName,
          captured_at: new Date(),
          status: "success"
        })

      const nextCapture = calculateNextCapture(url.schedule_type)

      await supabase
        .from("urls")
        .update({ next_capture: nextCapture })
        .eq("id", url.id)

      /*
      IMPORTANT LINE
      Deletes the temporary PDF after upload
      */

      fs.unlinkSync(filePath)

      console.log("Capture stored")

    } catch (err) {

      console.error("Capture failed:", err)

      await supabase
        .from("captures")
        .insert({
          url_id: url.id,
          captured_at: new Date(),
          status: "failed"
        })

    }

  }

  await browser.close()
}

run()
