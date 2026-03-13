import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import fs from "fs"
import path from "path"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  try {

    const { urlId } = await req.json()

    const { data: urlData, error } = await supabase
      .from("urls")
      .select("*")
      .eq("id", urlId)
      .single()

    if (error || !urlData) {
      return NextResponse.json({ error: "URL not found" }, { status: 400 })
    }

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    await page.goto(urlData.url, {
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

    const fileName = `capture-${urlData.id}-${Date.now()}.pdf`
    const filePath = path.join("/tmp", fileName)

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
      console.error(uploadError)
      return NextResponse.json({ error: "Upload failed" })
    }

    await supabase.from("captures").insert({
      url_id: urlData.id,
      file_path: fileName,
      captured_at: new Date(),
      status: "success"
    })

    fs.unlinkSync(filePath)

    await browser.close()

    return NextResponse.json({ success: true })

  } catch (err) {

    console.error(err)

    return NextResponse.json({ error: "Capture failed" }, { status: 500 })

  }

}
