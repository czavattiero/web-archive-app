require("dotenv").config({ path: ".env.local" })

const puppeteer = require("puppeteer")
const fs = require("fs")
const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createScheduledJobs() {

  const now = new Date().toISOString()

  const { data: urls, error } = await supabase
    .from("urls")
    .select("*")
    .lte("next_capture_at", now)

  if (error) {
    console.log("Scheduler query error:", error)
    return
  }

  console.log("Scheduled URLs found:", urls)

  if (!urls || urls.length === 0) {
    return
  }

  for (const site of urls) {

    console.log("Scheduled capture triggered:", site.url)

    await supabase.from("screenshot_jobs").insert({
      url: site.url,
      status: "pending"
    })

    if (site.schedule_value > 0) {

      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + site.schedule_value)

      await supabase
        .from("urls")
        .update({ next_capture_at: nextDate.toISOString() })
        .eq("id", site.id)

    }

  }

}

async function processJobs() {

  const { data: jobs } = await supabase
    .from("screenshot_jobs")
    .select("*")
    .eq("status", "pending")
    .limit(1)

  if (!jobs || jobs.length === 0) {
    console.log("Checking for pending jobs...")
    console.log("No pending jobs")
    return
  }

  const job = jobs[0]

  console.log("Processing:", job.url)

  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.goto(job.url, { waitUntil: "networkidle2" })

  // Alberta time (Mountain Time)
  const timestamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Edmonton",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date())

  await page.evaluate((url, timestamp) => {

    const header = document.createElement("div")

    header.style.width = "100%"
    header.style.background = "#f2f2f2"
    header.style.borderBottom = "2px solid #000"
    header.style.padding = "10px"
    header.style.fontSize = "12px"
    header.style.fontFamily = "Arial"

    header.innerHTML = `
      <strong>Captured URL:</strong> ${url}<br>
      <strong>Capture Time (Alberta):</strong> ${timestamp}<br>
      <strong>Archived by:</strong> Website Archiving Service
    `

    document.body.insertBefore(header, document.body.firstChild)

  }, job.url, timestamp)

  const filePath = `/tmp/${job.id}.pdf`

  await page.pdf({
    path: filePath,
    format: "A4",
    printBackground: true
  })

  await browser.close()

  const fileBuffer = fs.readFileSync(filePath)

  const { error } = await supabase.storage
    .from("screenshots")
    .upload(`${job.id}.pdf`, fileBuffer, {
      contentType: "application/pdf",
      upsert: true
    })

  if (error) {
    console.error("Upload failed:", error)
    return
  }

  const publicUrl =
    
`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/${job.id}.pdf`

  await supabase
    .from("screenshot_jobs")
    .update({
      status: "complete",
      image_url: publicUrl
    })
    .eq("id", job.id)

  console.log("Capture saved:", publicUrl)

}

async function workerLoop() {

  await createScheduledJobs()

  await processJobs()

}

setInterval(workerLoop, 10000)
