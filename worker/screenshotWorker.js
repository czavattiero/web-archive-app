import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import fs from "fs"

// Resolve project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env.local") })

console.log("SUPABASE_URL:", process.env.SUPABASE_URL)

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
    .eq("status", "active")
    .lte("next_capture_at", now)

  if (error) {
    console.error("Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs to capture.")
    return
  }

  console.log(`Found ${urls.length} URLs to capture`)

  const browser = await chromium.launch({ headless: true })

  for (const url of urls) {

    try {

      console.log("Capturing:", url.url)

      const page = await browser.newPage()

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
      const filePath = path.join(__dirname, "../screenshots", fileName)

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

      await supabase.from("captures").insert({
        url_id: url.id,
        file_path: fileName,
        captured_at: new Date(),
        status: "success"
      })

      console.log("Capture stored successfully")

      fs.unlinkSync(filePath)

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

  console.log("Worker finished")

}

run()
