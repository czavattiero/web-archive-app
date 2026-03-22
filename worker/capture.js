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

  // ✅ FETCH URLS (NO FILTER FOR DEBUG)
const { data: urls, error } = await supabase
  .from("urls")
  .select("*")

// 🔥 DEBUG LOG (PUT IT RIGHT HERE)
console.log("🔥 URLs FROM DB:", urls)

if (error) {
  console.error("❌ Fetch error:", error)
  return
}

if (!urls || urls.length === 0) {
  console.log("⚠️ No URLs found")
  return
}

console.log(`✅ Found ${urls.length} URLs`)

  if (error) {
    console.error("❌ Fetch error:", error)
    throw error
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

    if (!urlObj.id) {
      console.error("❌ Missing url_id — skipping")
      continue
    }

    if (!urlObj.user_id) {
      console.error("❌ Missing user_id — THIS IS LIKELY THE BUG")
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

      // ✅ UPLOAD
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

      console.log("✅ Upload success:", filePath)

      // ✅ INSERT INTO DB
      await insertCapture({
        urlObj,
        file_path: filePath,
        status: "success",
        error: null,
      })

      // ✅ UPDATE NEXT CAPTURE
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

// 🔥 FINAL INSERT FUNCTION (WITH HARD FAIL)
async function insertCapture({ urlObj, file_path, status, error }) {
  try {
    if (!urlObj?.id) {
      throw new Error("Missing url_id")
    }

    if (!urlObj?.user_id) {
      throw new Error("Missing user_id")
    }

    const payload = {
      url_id: urlObj.id,
      user_id: urlObj.user_id,
      file_path: file_path || null,
      status: status || "unknown",
      error: error || null,
      created_at: new Date().toISOString(),
    }

    console.log("📥 INSERT PAYLOAD:", JSON.stringify(payload, null, 2))

    const { data, error: insertError } = await supabase
      .from("captures")
      .insert([payload])
      .select()

    if (insertError) {
      console.error("❌ INSERT ERROR FULL:", insertError)
      throw insertError // 🔥 THIS FORCES GITHUB ACTION TO FAIL
    }

    console.log("✅ INSERT SUCCESS:", data)

  } catch (err) {
    console.error("💥 FINAL INSERT FAILURE:", err.message)
    throw err // 🔥 ALSO FAIL HERE
  }
}

run()
