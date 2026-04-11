import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

dotenv.config()

// ✅ Init Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ✅ Helper: Calculate next capture date
function calculateNextCapture(scheduleType) {
  const now = new Date()

  switch (scheduleType) {
    case "weekly":
      now.setDate(now.getDate() + 7)
      return now.toISOString()

    case "biweekly":
      now.setDate(now.getDate() + 14)
      return now.toISOString()

    case "monthly":
      now.setMonth(now.getMonth() + 1)
      return now.toISOString()

    default:
      return null
  }
}

// ✅ Main Worker
async function runWorker() {
  console.log("🚀 Worker started")

  const now = new Date()

  // ❗ IMPORTANT: FETCH ALL URLS (NO FILTER)
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs found")
    return
  }

  console.log(`📦 Found ${urls.length} URLs`)

  for (const item of urls) {
    console.log("🔎 Checking:", item.url)

    const lastCaptured = item.last_captured_at
      ? new Date(item.last_captured_at)
      : null

    const nextCapture = item.next_capture_at
      ? new Date(item.next_capture_at)
      : null

    console.log({
      lastCaptured,
      nextCapture,
      now,
    })

    let shouldCapture = false

    // 🚀 NEW URL → capture immediately
    if (!lastCaptured) {
      shouldCapture = true
      console.log("🔥 NEW URL → capturing now")
    }

    // ⏰ Scheduled capture
    else if (nextCapture && nextCapture <= now) {
      shouldCapture = true
      console.log("⏰ SCHEDULED → capturing now")
    }

    // ⛔ Skip
    if (!shouldCapture) {
      console.log("⛔ Skipping:", item.url)
      continue
    }

    try {
      // 🌐 Launch browser
      const browser = await chromium.launch()
      const page = await browser.newPage()

      console.log("🌍 Opening page...")
      await page.goto(item.url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

      console.log("📄 Generating PDF...")

      const pdfBuffer = await page.pdf({
        format: "A4",
      })

      await browser.close()

      // 📁 File name
      const fileName = `captures/${item.id}_${Date.now()}.pdf`

      // ☁️ Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, pdfBuffer, {
          contentType: "application/pdf",
        })

      if (uploadError) {
        console.error("❌ Upload error:", uploadError)
        continue
      }

      // 🔗 Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("captures")
        .getPublicUrl(fileName)

      const publicUrl = publicUrlData.publicUrl

      console.log("✅ Uploaded:", publicUrl)

      // 🧾 Insert into captures table
      const { error: insertError } = await supabase
        .from("captures")
        .insert({
          url_id: item.id,
  file_path: publicUrl, // ✅ MATCH YOUR DB
  user_id: item.user_id, // ✅ IMPORTANT (you have this column)
  status: "success",
})

      if (insertError) {
        console.error("❌ Insert error:", insertError)
        continue
      }

      // 🔄 Update URL record
      const next = calculateNextCapture(item.schedule_type)

      const { error: updateError } = await supabase
        .from("urls")
        .update({
          last_captured_at: now.toISOString(),
          next_capture_at: next,
        })
        .eq("id", item.id)

      if (updateError) {
        console.error("❌ Update error:", updateError)
      } else {
        console.log("✅ URL updated")
      }

    } catch (err) {
      console.error("❌ Capture failed:", err)
    }
  }

  console.log("🎉 Worker finished")
}

runWorker()