process.env.TZ = "America/Edmonton"

import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)

async function runEmailWarning() {

  console.log("Checking captures approaching deletion")

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)

  const { data: captures, error } = await supabase
    .from("captures")
    .select(`
      id,
      file_path,
      created_at,
      screenshot_jobs (
        user_id,
        url
      )
    `)
    .lt("created_at", cutoff.toISOString())

  if (error) {
    console.log("Database error:", error)
    return
  }

  if (!captures || captures.length === 0) {
    console.log("No warning emails needed")
    return
  }

  for (const item of captures) {

    const email = "user@example.com"

    const url = item.screenshot_jobs.url

    console.log("Sending warning email for:", url)

    try {

      await resend.emails.send({
        from: "Screenly Archive <alerts@yourdomain.com>",
        to: email,
        subject: "Your archived capture will be deleted in 2 days",
        html: `
          <p>This is a reminder that your archived capture will be deleted in 2 days.</p>
          <p><strong>URL:</strong> ${url}</p>
          <p>If you want to keep it, please download the PDF before deletion.</p>
        `
      })

    } catch (err) {

      console.log("Email error:", err)

    }

  }

}

runEmailWarning()
