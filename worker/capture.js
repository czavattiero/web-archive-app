import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"

console.log("🚀 HARD DEBUG WORKER START")

// 🔐 INIT
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🧪 STEP 1 — VERIFY DB CONNECTION
async function testDatabase() {
  console.log("🧪 Testing DB insert...")

  const { data, error } = await supabase.from("captures").insert({
    url_id: null,
    file_path: "debug-test.pdf",
    status: "debug",
    created_at: new Date().toISOString(),
  }).select()

  if (error) {
    console.error("❌ DB INSERT FAILED:", error)
    throw new Error("DB FAILED")
  }

  console.log("✅ DB WORKING:", data)
}

// 🧪 STEP 2 — VERIFY STORAGE
async function testStorage() {
  console.log("🧪 Testing STORAGE upload...")

  const buffer = Buffer.from("test file")

  const fileName = `debug-${Date.now()}.txt`

  const { error } = await supabase.storage
    .from("captures")
    .upload(fileName, buffer, {
      contentType: "text/plain",
      upsert: true,
    })

  if (error) {
    console.error("❌ STORAGE FAILED:", error)
    throw new Error("STORAGE FAILED")
  }

  console.log("✅ STORAGE WORKING:", fileName)
}

// 🌐 SIMPLE CAPTURE
async function captureSimple(browser, url) {
  const page = await browser.newPage()

  console.log("🌐 Opening:", url)

  await page.goto(url, { timeout: 60000 })

  const pdf = await page.pdf({ format: "A4" })

  await page.close()

  console.log("✅ PDF created")

  return pdf
}

// 🏁 MAIN
async function run() {
  try {
    await testDatabase()
    await testStorage()
  } catch (err) {
    console.error("🔥 CRITICAL SETUP FAILURE:", err.message)
    return
  }

  console.log("📦 Fetching URLs...")

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")

  if (error) {
    console.error("❌ URL FETCH ERROR:", error)
    return
  }

  console.log("📦 URLs FOUND:", urls?.length)

  if (!urls || urls.length === 0) {
    console.log("❌ NO URLS FOUND")
    return
  }

  const browser = await chromium.launch({ headless: true })

  for (const u of urls) {
    try {
      const pdf = await captureSimple(browser, u.url)

      const fileName = `${u.id}-${Date.now()}.pdf`

      // 🔥 UPLOAD
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdf, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (uploadError) {
        console.error("❌ UPLOAD ERROR:", uploadError)
        continue
      }

      console.log("✅ FILE UPLOADED:", fileName)

      // 🔥 INSERT
      const { error: insertError } = await supabase
        .from("captures")
        .insert({
          url_id: u.id,
          file_path: fileName,
          status: "success",
          created_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error("❌ INSERT ERROR:", insertError)
      } else {
        console.log("✅ INSERT SUCCESS")
      }

    } catch (err) {
      console.error("❌ CAPTURE ERROR:", err.message)
    }
  }

  await browser.close()

  console.log("🏁 DONE")
}

run()
