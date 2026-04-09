import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log("🚀 Worker started")

  // ✅ FETCH ALL URLS (no filters for now)
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")

  console.log("🧪 URLS FETCHED:", urls)

  if (error) {
    console.error("❌ Error fetching URLs:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("No URLs to process")
    return
  }

  const browser = await chromium.launch({ headless: true })

  for (const item of urls) {

  console.log("🔍 CHECKING URL:", {
    id: item.id,
    last_captured_at: item.last_captured_at,
    next_capture_at: item.next_capture_at,
  })

  const now = new Date()

// ✅ New URL → capture immediately
if (!item.last_captured_at) {
  console.log("🟢 NEW URL → RUN")
}

// ✅ Scheduled → ONLY if next_capture_at exists AND is due
else if (
  item.next_capture_at &&
  new Date(item.next_capture_at) <= now
) {
  console.log("🟡 SCHEDULED → RUN")
}

// ❌ Everything else → skip
else {
  console.log("⛔ SKIPPED")
  continue
}
    
    const url = item.url
    console.log("🌐 Capturing:", url)

    let page

    try {
      page = await browser.newPage()

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      })

      await page.waitForTimeout(3000)

      // ✅ PDF
      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
      })

      const fileName = `screenshots/${item.id}-${Date.now()}.pdf`

      const { error: uploadError } = await supabase.storage
        .from("captures")
        .upload(fileName, buffer, {
          contentType: "application/pdf",
          upsert: true,
        })

      if (uploadError) {
        throw uploadError
      }

      const { data, error: insertError } = await supabase
        .from("captures")
        .insert([
          {
            url_id: item.id,
            file_path: fileName,
            user_id: item.user_id,
            created_at: new Date().toISOString(),
          },
        ])
        .select()

      console.log("📦 INSERT RESULT:", { data, insertError })

      const next = new Date()

if (item.schedule === "weekly") {
  next.setDate(next.getDate() + 7)
} 
else if (item.schedule === "biweekly") {
  next.setDate(next.getDate() + 14)
} 
else if (item.schedule === "29_days") {
  next.setDate(next.getDate() + 29)
} 
else if (item.schedule === "30_days") {
  next.setDate(next.getDate() + 30)
} 
else if (item.schedule === "specific_date") {
  // use stored date (must exist in DB)
  next.setTime(new Date(item.specific_date).getTime())
} 
else {
  // fallback safety
  next.setMinutes(next.getMinutes() + 5)
}

const { error: updateError } = await supabase
  .from("urls")
  .update({
    last_captured_at: new Date().toISOString(),
    next_capture_at: next.toISOString(),
  })
  .eq("id", item.id)

if (updateError) {
  console.error("❌ UPDATE FAILED:", updateError)
} else {
  console.log("✅ URL UPDATED:", item.id)
}

      console.log("✅ Success:", url)

    } catch (err) {
      console.error("❌ Failed:", url, err.message)
    } finally {
      if (page) await page.close()
    }
  }

  await browser.close()
  console.log("🏁 Worker finished")
}

run()
