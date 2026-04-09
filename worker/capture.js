
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
    if (item.last_captured_at) {
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

      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
        })
        .eq("id", item.id)

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

