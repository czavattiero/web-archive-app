import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

export async function POST(req: Request) {
  const { urlId } = await req.json()

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log("🔥 API CAPTURE TRIGGERED:", urlId)

  // ✅ Get ONLY the new URL
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("id", urlId)

  if (error || !urls || urls.length === 0) {
    console.log("No URL found")
    return Response.json({ success: false })
  }

  const browser = await chromium.launch({ headless: true })

  for (const item of urls) {
    try {
      const page = await browser.newPage()

      console.log("🌐 Capturing:", item.url)

      await page.goto(item.url, {
        waitUntil: "networkidle",
        timeout: 60000,
      })

      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
      })

      const fileName = `capture-${item.id}-${Date.now()}.pdf`

      await supabase.storage
        .from("captures")
        .upload(fileName, buffer, {
          contentType: "application/pdf",
        })

      await supabase.from("captures").insert({
        url_id: item.id,
        file_path: fileName,
        user_id: item.user_id,
        created_at: new Date().toISOString(),
        status: "success",
      })

      // ✅ update timestamps
      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
          next_capture_at: new Date(Date.now() + 7 * 86400000), // weekly fallback
        })
        .eq("id", item.id)

      await page.close()

      console.log("✅ Capture complete:", item.url)

    } catch (err) {
      console.error("❌ Capture failed:", err)
    }
  }

  await browser.close()

  return Response.json({ success: true })
}