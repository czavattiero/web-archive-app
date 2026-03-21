import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

// Setup env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log("🚀 Worker started")

  // ✅ FETCH URLS (INCLUDING user_id)
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (error) {
    console.error("❌ Fetch error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs found")
    return
  }

  console.log(`✅ Found ${urls.length} URLs`)

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  })

  const context = await browser.newContext()

  for (const urlObj of urls) {
    console.log("🔍 Processing:", urlObj)

    if (!urlObj.id || !urlObj.user_id) {
      console.error("❌ Missing id or user_id — skipping")
      continue
    }

    const page = await context.newPage()

    try {
      await page.goto(urlObj.url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

      const filePath = `${urlObj.id}-${Date.now()}.pdf`

      const pdfBuffer = await page.pdf({ format: "A4" })

      // ✅ Upload
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.error("❌ Upload failed:", uploadError)

        await insertCapture({
          urlObj,
          file_path: null,
          status: "failed",
          error: uploadError.message,
        })

        continue
      }

      console.log("✅ Upload success")

      // ✅ INSERT (FIXED — includes user_id)
      await insertCapture({
        urlObj,
        file_path: filePath,
        status: "success",
        error: null,
      })

      // ✅ Update schedule
      const next = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await supabase
        .from("urls")
        .update({ next_capture_at: next.toISOString() })
        .eq("id", urlObj.id)

    } catch (err) {
      console.error("❌ Capture failed:", err)

      await insertCapture({
        urlObj,
        file_path: null,
        status: "failed",
        error: err.message,
      })
    }

    await page.close()
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

// 🔥 FIXED INSERT FUNCTION (NOW INCLUDES user_id)
async function insertCapture({ urlObj, file_path, status, error }) {
  console.log("📥 Inserting capture...")

  const payload = {
    url_id: urlObj.id,
    user_id: urlObj.user_id, // 🔥 THIS IS THE FIX
    file_path,
    status,
    error,
    created_at: new Date().toISOString(),
  }

  console.log("Payload:", payload)

  const { data, error: insertError } = await supabase
    .from("captures")
    .insert([payload])
    .select()

  if (insertError) {
    console.error("❌ INSERT ERROR:", insertError)
  } else {
    console.log("✅ INSERT SUCCESS:", data)
  }
}

run()
