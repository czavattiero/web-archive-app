import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import fs from "fs"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {

  console.log("Fetching URLs...")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")

  if (error) {
    console.error(error)
    return
  }

  const browser = await chromium.launch()

  for (const url of urls) {

    try {

      console.log("Capturing:", url.url)

      const page = await browser.newPage()

      await page.goto(url.url, { waitUntil: "networkidle" })

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
      const filePath = `./screenshots/${fileName}`

      await page.pdf({
        path: filePath,
        format: "A4"
      })

      const fileBuffer = fs.readFileSync(filePath)

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf"
        })

      if (uploadError) {
        console.error(uploadError)
        continue
      }

      await supabase.from("captures").insert({
        url_id: url.id,
        file_path: fileName,
        captured_at: new Date(),
        status: "success"
      })

      console.log("Capture stored")

    } catch (err) {

      console.error("Capture failed:", err)

      await supabase.from("captures").insert({
        url_id: url.id,
        captured_at: new Date(),
        status: "failed"
      })

    }

  }

  await browser.close()

}

run()
