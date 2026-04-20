import dotenv from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { DateTime } from "luxon"

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL || "Screenly <noreply@screenly.ca>"

async function runCleanup() {
  console.log("🧹 Cleanup worker started")

  const now = DateTime.now().setZone("America/Edmonton")

  let warnedUsers = 0
  let deletedUrls = 0
  let deletedCaptures = 0

  // --- WARNING EMAILS (day 60) ---
  const day60Start = now.minus({ days: 61 }).toUTC().toISO()
  const day60End = now.minus({ days: 60 }).toUTC().toISO()

  console.log(`📧 Querying URLs created between ${day60Start} and ${day60End}...`)

  const { data: warnUrls, error: warnError } = await supabase
    .from("urls")
    .select("id, url, user_id, created_at")
    .lte("created_at", day60End)
    .gt("created_at", day60Start)

  if (warnError) {
    console.error("❌ Error querying URLs for warning:", warnError)
  } else if (warnUrls && warnUrls.length > 0) {
    console.log(`📬 Found ${warnUrls.length} URL(s) to warn about`)

    // Group by user_id
    const byUser = {}
    for (const row of warnUrls) {
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = []
      }
      byUser[row.user_id].push(row)
    }

    const deletionDate = now.plus({ days: 2 }).toFormat("MMM d, yyyy")

    for (const [userId, urls] of Object.entries(byUser)) {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(userId)

        if (userError || !userData?.user?.email) {
          console.error(`❌ Could not fetch email for user ${userId}:`, userError)
          continue
        }

        const userEmail = userData.user.email

        const urlListHtml = urls
          .map((u) => `<li style="margin-bottom:6px;"><code>${u.url}</code></li>`)
          .join("")

        const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <h2 style="color:#e53e3e;">⚠️ Your archived URLs will be deleted in 2 days</h2>
  <p>Hi,</p>
  <p>As part of our <strong>62-day data retention policy</strong>, the following archived URLs are scheduled for automatic deletion on <strong>${deletionDate}</strong>:</p>
  <ul style="background:#fff8f8;border:1px solid #fed7d7;border-radius:6px;padding:16px 16px 16px 32px;">
    ${urlListHtml}
  </ul>
  <p>This includes all associated capture files (PDFs) stored for these URLs.</p>
  <p>If you wish to keep these captures, please download them from your dashboard before <strong>${deletionDate}</strong>.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:12px;color:#999;">This is an automated message from Screenly. Deletion occurs automatically 62 days after a URL is added per our data retention policy.</p>
</div>`

        const { error: emailError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: userEmail,
          subject: "⚠️ Your archived URLs will be deleted in 2 days",
          html,
        })

        if (emailError) {
          console.error(`❌ Failed to send warning email to ${userEmail}:`, emailError)
        } else {
          console.log(`✉️ Warning email sent to ${userEmail} (${urls.length} URL(s))`)
          warnedUsers++
        }
      } catch (err) {
        console.error(`❌ Error processing warning for user ${userId}:`, err.message)
      }
    }
  } else {
    console.log("ℹ️ No URLs in the 60-day warning window")
  }

  // --- DELETION (day 62+) ---
  const day62Cutoff = now.minus({ days: 62 }).toUTC().toISO()

  console.log(`🗑️ Querying URLs created before ${day62Cutoff}...`)

  const { data: expiredUrls, error: expireError } = await supabase
    .from("urls")
    .select("id, url, user_id")
    .lte("created_at", day62Cutoff)

  if (expireError) {
    console.error("❌ Error querying expired URLs:", expireError)
  } else if (expiredUrls && expiredUrls.length > 0) {
    console.log(`🗑️ Found ${expiredUrls.length} expired URL(s) to delete`)

    for (const urlRow of expiredUrls) {
      try {
        // 1. Fetch all captures for this URL
        const { data: captures, error: capturesError } = await supabase
          .from("captures")
          .select("id, file_path")
          .eq("url_id", urlRow.id)

        if (capturesError) {
          console.error(`❌ Error fetching captures for URL ${urlRow.url}:`, capturesError)
          continue
        }

        const captureCount = captures ? captures.length : 0

        // 2. Delete each capture's PDF from storage
        if (captures && captures.length > 0) {
          for (const capture of captures) {
            if (capture.file_path) {
              const { error: storageError } = await supabase.storage
                .from("captures")
                .remove([capture.file_path])

              if (storageError) {
                console.error(
                  `❌ Error deleting storage file ${capture.file_path}:`,
                  storageError
                )
              }
            }
          }
        }

        // 3. Delete all captures rows for this URL
        const { error: deleteCapturesError } = await supabase
          .from("captures")
          .delete()
          .eq("url_id", urlRow.id)

        if (deleteCapturesError) {
          console.error(`❌ Error deleting captures for URL ${urlRow.url}:`, deleteCapturesError)
          continue
        }

        // 4. Delete the URL row
        const { error: deleteUrlError } = await supabase
          .from("urls")
          .delete()
          .eq("id", urlRow.id)

        if (deleteUrlError) {
          console.error(`❌ Error deleting URL ${urlRow.url}:`, deleteUrlError)
          continue
        }

        // 5. Log deletion
        console.log(`🗑️ Deleted URL "${urlRow.url}" and ${captureCount} capture(s)`)
        deletedUrls++
        deletedCaptures += captureCount
      } catch (err) {
        console.error(`❌ Error deleting URL ${urlRow.url}:`, err.message)
      }
    }
  } else {
    console.log("ℹ️ No expired URLs to delete")
  }

  console.log(
    `✅ Cleanup complete. Warned: ${warnedUsers} users. Deleted: ${deletedUrls} URLs, ${deletedCaptures} captures.`
  )
}

runCleanup().catch((err) => {
  console.error("❌ Cleanup worker failed:", err)
  process.exit(1)
})
