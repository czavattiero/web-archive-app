import { NextResponse } from "next/server"
import { chromium } from "playwright"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  try {

    const { url, url_id } = await req.json()

    console.log("Starting instant capture:", url)

    const browser = await chromium.launch()

    const page = await browser.newPage()

    await page.goto(url, { waitUntil: "networkidle" })

    const fileName = `${url_id}-${Date.now()}.pdf`

    const filePath = `/tmp/${fileName}`

    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true
    })

    await browser.close()

    const fileBuffer = fs.readFileSync(filePath)

    const { error: uploadError } = await supabase
      .storage
      .from("captures")
      .upload(fileName, fileBuffer, {
        contentType: "application/pdf"
      })

    if (uploadError) {
      console.error(uploadError)
      throw uploadError
    }

    const { error: insertError } = await supabase
      .from("captures")
      .insert({
        url_id: url_id,
        file_path: fileName
      })

    if (insertError) {
      console.error(insertError)
      throw insertError
    }

    console.log("Capture stored successfully")

    return NextResponse.json({
      success: true,
      file: fileName
    })

  } catch (error) {

    console.error("Capture error:", error)

    return NextResponse.json(
      { error: "Capture failed" },
      { status: 500 }
    )
  }
}
