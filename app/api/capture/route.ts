import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

export async function POST(req: Request) {
  try {
    console.log("🔥 API HIT")

    const { urlId } = await req.json()
    console.log("🔥 URL ID:", urlId)

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: urls, error } = await supabase
      .from("urls")
      .select("*")
      .eq("id", urlId)

    if (error) {
      console.error("❌ DB ERROR:", error)
      throw error
    }

    if (!urls || urls.length === 0) {
      throw new Error("No URL found")
    }

    const browser = await chromium.launch({ headless: true })

    for (const item of urls) {
      console.log("🌐 Capturing:", item.url)

      const page = await browser.newPage()

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

      await supabase
        .from("urls")
        .update({
          last_captured_at: new Date().toISOString(),
          next_capture_at: new Date(Date.now() + 7 * 86400000),
        })
        .eq("id", item.id)

      await page.close()
    }

    await browser.close()

    return Response.json({ success: true })

  } catch (err: any) {
    console.error("💥 API ERROR:", err)

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    )
  }
}