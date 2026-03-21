import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

// Setup env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

// Supabase client (SERVICE ROLE - REQUIRED)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log("🚀 Worker started")

  // STEP 1 — FETCH URLS
  const { data: urls, error: fetchError } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", new Date().toISOString())

  if (fetchError) {
    console.error("❌ Fetch error:", fetchError)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs to process")
    return
  }

  console.log(`✅ Found ${urls.length} URLs`)

  // STEP 2 — LAUNCH BROWSER
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  const context = await browser.newContext()

  for (const urlObj of urls) {
    console.log("🔍 Processing:", urlObj)

    if (!urlObj.id) {
      console.error("❌ Missing URL ID — skipping")
      continue
    }

    const page = await context.newPage()

    try {
      await page.goto(urlObj.url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

      const filePath = `${urlObj.id}-${Date.now()}.pdf`

      // STEP 3 — GENERATE PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
      })

      // STEP 4 — UPLOAD TO STORAGE
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(filePath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: false,
        })

      if (uploadError) {
        console.error("❌ Upload failed:", uploadError)

        await insertCapture({
          url_id: urlObj.id,
          file_path: null,
          status: "failed",
          error: uploadError.message,
        })

        continue
      }

      console.log("✅ Upload success:", filePath)

      // STEP 5 — INSERT INTO DB (CRITICAL FIX)
      await insertCapture({
        url_id: urlObj.id,
        file_path: filePath,
        status: "success",
        error: null,
      })

      // STEP 6 — UPDATE NEXT CAPTURE
      const nextCapture = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await supabase
        .from("urls")
        .update({ next_capture_at: nextCapture.toISOString() })
        .eq("id", urlObj.id)

    } catch (err) {
      console.error("❌ Capture failed:", err)

      await insertCapture({
        url_id: urlObj.id,
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

// 🔥 SAFE INSERT FUNCTION (NO SILENT FAILURES)
async function insertCapture({ url_id, file_path, status, error }) {
  console.log("📥 Inserting capture:", {
    url_id,
    file_path,
    status,
  })

  const { data, error: insertError } = await supabase
    .from("captures")
    .insert([
      {
        url_id,
        file_path,
        status,
        error,
        created_at: new Date().toISOString(),
      },
    ])
    .select()

  if (insertError) {
    console.error("❌ INSERT ERROR:", insertError)
  } else {
    console.log("✅ INSERT SUCCESS:", data)
  }
}

// RUN
run()
