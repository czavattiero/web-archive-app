import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "playwright"

// Setup env
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 🔥 RETRY LOADER
async function loadPageWithRetry(page, url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`🌐 محاولة ${i + 1}: ${url}`)

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      })

      return true
    } catch (err) {
      console.error("❌ Attempt failed:", err.message)

      if (i === retries) return false

      await page.waitForTimeout(3000)
    }
  }
}

async function run() {
  console.log("🚀 Worker started")

  const now = new Date().toISOString()

  // ✅ ONLY FETCH DUE URLS
  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .eq("status", "active")
    .lte("next_capture_at", now)

  console.log("🔥 URLs TO PROCESS:", urls)

  if (error) {
    console.error("❌ Fetch error:", error)
    return
  }

  if (!urls || urls.length === 0) {
    console.log("⚠️ No URLs due for capture")
    return
  }

  console.log(`✅ Processing ${urls.length} URLs`)

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
     
