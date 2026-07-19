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
const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"

async function runCleanup() {
  console.log("🧹 Cleanup worker started")

  const now = DateTime.now().setZone("America/Edmonton")

  let warnedUsers = 0
  let deletedCaptures = 0

  // --- WARNING EMAILS (captures approaching 62 days old) ---
  // Retention is keyed off captures.captured_at, NOT urls.created_at. This means
  // a URL with an active recurring schedule is never touched here — only its
  // individual old capture files age out, one at a time, on their own 62-day clock.
  const day60Start = now.minus({ days: 61 }).toUTC().toISO()
  const day60End = now.minus({ days: 60 }).toUTC().toISO()

  console.log(`📧 Querying captures taken between ${day60Start} and ${day60End}...`)

  const { data: warnCaptures, error: warnError } = await supabase
    .from("captures")
    .select("id, url_id, user_id, captured_at, urls(url)")
    .lte("captured_at", day60End)
    .gt("captured_at", day60Start)
    .eq("status", "success")

  if (warnError) {
    console.error("❌ Error querying captures for warning:", warnError)
  } else if (warnCaptures && warnCaptures.length > 0) {
    console.log(`📬 Found ${warnCaptures.length} capture(s) to warn about`)

    // Group by user_id
    const byUser = {}
    for (const row of warnCaptures) {
      if (!byUser[row.user_id]) {
        byUser[row.user_id] = []
      }
      byUser[row.user_id].push(row)
    }

    const deletionDate = now.plus({ days: 2 }).toFormat("MMM d, yyyy")

    for (const [userId, captures] of Object.entries(byUser)) {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(userId)

        if (userError || !userData?.user?.email) {
          console.error(`❌ Could not fetch email for user ${userId}:`, userError)
          continue
        }

        const userEmail = userData.user.email

        const captureListHtml = captures
          .map((c) => {
            const capturedDate = DateTime.fromISO(c.captured_at, { zone: "utc" })
              .setZone("America/Edmonton")
              .toFormat("MMM d, yyyy")
            const urlText = c.urls?.url || "(URL unavailable)"
            return `<li style="margin-bottom:6px;"><code>${urlText}</code> — captured ${capturedDate}</li>`
          })
          .join("")

        const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <h2 style="color:#e53e3e;">⚠️ Some of your capture files will be deleted in 2 days</h2>
  <p>Hi,</p>
  <p>As part of our <strong>62-day data retention policy</strong>, the following capture files are scheduled for automatic deletion on <strong>${deletionDate}</strong>:</p>
  <ul style="background:#fff8f8;border:1px solid #fed7d7;border-radius:6px;padding:16px 16px 16px 32px;">
    ${captureListHtml}
  </ul>
  <p>This only affects these specific capture files — any URL you have set to recur will continue to be captured on its normal schedule, and each new capture gets its own 62-day retention window.</p>
  <p>If you wish to keep a copy of any of these captures, please download them from your dashboard before <strong>${deletionDate}</strong>.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:12px;color:#999;">This is an automated message from Timedshot. Individual capture files are automatically deleted 62 days after they are taken, per our data retention policy.</p>
</div>`

        const { error: emailError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: userEmail,
          subject: "⚠️ Some of your capture files will be deleted in 2 days",
          html,
        })

        if (emailError) {
          console.error(`❌ Failed to send warning email to ${userEmail}:`, emailError)
        } else {
          console.log(`✉️ Warning email sent to ${userEmail} (${captures.length} capture(s))`)
          warnedUsers++
        }
      } catch (err) {
        console.error(`❌ Error processing warning for user ${userId}:`, err.message)
      }
    }
  } else {
    console.log("ℹ️ No captures in the 60-day warning window")
  }

  // --- DELETION (captures 62+ days old) ---
  // Only individual capture rows/files are removed. The parent urls row is never
  // touched, so recurring schedules and next_capture_at are completely unaffected.
  const day62Cutoff = now.minus({ days: 62 }).toUTC().toISO()

  console.log(`🗑️ Querying captures taken before ${day62Cutoff}...`)

  const { data: expiredCaptures, error: expireError } = await supabase
    .from("captures")
    .select("id, url_id, file_path")
    .lte("captured_at", day62Cutoff)

  if (expireError) {
    console.error("❌ Error querying expired captures:", expireError)
  } else if (expiredCaptures && expiredCaptures.length > 0) {
    console.log(`🗑️ Found ${expiredCaptures.length} expired capture(s) to delete`)

    for (const capture of expiredCaptures) {
      try {
        // 1. Delete the PDF from storage, if present
        if (capture.file_path) {
          const { error: storageError } = await supabase.storage
            .from("captures")
            .remove([capture.file_path])

          if (storageError) {
            console.error(
              `❌ Error deleting storage file ${capture.file_path}:`,
              storageError
            )
            // Continue anyway — better to remove the DB row than leave an
            // orphaned reference to a file we already tried to delete.
            // Log the failure so the orphaned file can be found and cleaned
            // up later instead of silently accumulating in storage.
            const { error: logError } = await supabase
              .from("storage_deletion_failures")
              .insert({
                capture_id: capture.id,
                file_path: capture.file_path,
                error: storageError.message || JSON.stringify(storageError),
              })
            if (logError) {
              console.error(
                `❌ Also failed to log storage deletion failure for ${capture.file_path}:`,
                logError
              )
            }
          }
        }

        // 2. Delete the capture row itself
        const { error: deleteCaptureError } = await supabase
          .from("captures")
          .delete()
          .eq("id", capture.id)

        if (deleteCaptureError) {
          console.error(`❌ Error deleting capture ${capture.id}:`, deleteCaptureError)
          continue
        }

        console.log(`🗑️ Deleted capture ${capture.id} (file: ${capture.file_path || "none"})`)
        deletedCaptures++
      } catch (err) {
        console.error(`❌ Error deleting capture ${capture.id}:`, err.message)
      }
    }
  } else {
    console.log("ℹ️ No expired captures to delete")
  }

  console.log(
    `✅ Cleanup complete. Warned: ${warnedUsers} users. Deleted: ${deletedCaptures} capture(s).`
  )
}

runCleanup().catch((err) => {
  console.error("❌ Cleanup worker failed:", err)
  process.exit(1)
})
