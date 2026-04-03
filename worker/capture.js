import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"
import { DateTime } from "luxon"

// Setup env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const MAX_RETRIES = 3
const RETRY_DELAY_MINUTES = 10

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Retry loader (unchanged)
async function loadPageWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      })
      return true
    } catch {
      if (i === retries) return false
      await new Promise((res) => setTimeout(res, 3000))
    }
  }
  return false
}

// Insert capture (unchanged)
async function insertCapture({ urlObj, file_path, status, error }) {
  await supabase.from("captures").insert([
    {
      url_id: urlObj.id,
      user_id: urlObj.user_id,
      file_path: file_path || null,
      status,
      error: error || null,
      created_at: new Date().toISOString(),
    },
  ])
}

// Scheduling (unchanged)
function getNextCaptureDate(urlObj) {
  const now = DateTime.now().setZone("America/Edmonton")

  let next

  if (urlObj.schedule_type === "custom") {
    if (!urlObj.schedule_value) return null

    next = DateTime.fromFormat(
      urlObj.schedule_value,
      "yyyy-MM-dd",
      { zone: "America/Edmonton" }
    ).set({ hour: 9, minute: 0, second: 0, millisecond: 0 })

    return next.toUTC().toJSDate()
  }

  next = now.set({ hour: 9, minute: 0, second: 0, millisecond: 0 })

  if (now >= next) next = next.plus({ days: 1 })

  switch (urlObj.schedule_type) {
    case "weekly":
      next = next.plus({ weeks: 1 })
      break
    case "biweekly":
      next = next.plus({ weeks: 2 })
      break
    case "29days":
      next = next.plus({ days: 29 })
      break
    case "30days":
      next = next.plus({ days: 30 })
      break
    default:
      next = next.plus({ weeks: 1 })
  }

  return next.toUTC().toJSDate()
}

// MAIN WORKER
async function run() {
  const nowISO = new Date().toISOString()

  const { data: urls } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")
    .lte("next_capture_at", nowISO)

  if (!urls || urls.length === 0) return

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()

  const BATCH_SIZE = 5

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)

    await Promise.all(
      batch.map(async (urlObj) => {
        const page = await context.newPage()

        try {
          const loaded = await loadPageWithRetry(page, urlObj.url)

          if (!loaded) throw new Error("Page failed to load")

          const filePath = `${urlObj.id}-${Date.now()}.pdf`

          const pdfBuffer = await page.pdf({ format: "A4" })

          await supabase.storage
            .from("captures")
            .upload(filePath, pdfBuffer)

          await insertCapture({
            urlObj,
            file_path: filePath,
            status: "success",
          })

          // ✅ RESET retry count on success
          const nextDate = getNextCaptureDate(urlObj)

          await supabase
            .from("urls")
            .update({
              retry_count: 0,
              last_captured_at: new Date().toISOString(),
              next_capture_at: nextDate?.toISOString() || null,
            })
            .eq("id", urlObj.id)

        } catch (err) {
          const retries = (urlObj.retry_count || 0) + 1

          if (retries >= MAX_RETRIES) {
            // ❌ permanently failed
            await supabase
              .from("urls")
              .update({
                status: "failed",
                retry_count: retries,
              })
              .eq("id", urlObj.id)

          } else {
            // 🔁 schedule retry soon
            const retryTime = DateTime.now()
              .plus({ minutes: RETRY_DELAY_MINUTES })
              .toUTC()
              .toISO()

            await supabase
              .from("urls")
              .update({
                retry_count: retries,
                next_capture_at: retryTime,
              })
              .eq("id", urlObj.id)
          }

          await insertCapture({
            urlObj,
            file_path: null,
            status: "failed",
            error: err.message,
          })
        }

        await page.close()
      })
    )
  }

  await browser.close()
}

run()
