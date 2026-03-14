const browser = await chromium.launch()

const page = await browser.newPage()

await page.goto(url.url, {
  waitUntil: "networkidle",
  timeout: 60000
})

const timestamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC")

const captureId = Date.now()

await page.evaluate((timestamp, url, captureId) => {

  const banner = document.createElement("div")

  banner.style.width = "100%"
  banner.style.background = "white"
  banner.style.color = "black"
  banner.style.fontFamily = "Arial, sans-serif"
  banner.style.fontSize = "14px"
  banner.style.padding = "10px"
  banner.style.borderBottom = "2px solid black"
  banner.style.lineHeight = "1.5"
  banner.style.boxSizing = "border-box"

  banner.innerHTML = `
    <div><strong>Captured:</strong> ${timestamp}</div>
    <div><strong>URL:</strong> ${url}</div>
    <div><strong>System:</strong> WebArchive</div>
    <div><strong>Capture ID:</strong> ${captureId}</div>
  `

  document.body.insertBefore(banner, document.body.firstChild)

}, timestamp, url.url, captureId)

const pdfBuffer = await page.pdf({
  format: "A4",
  printBackground: true
})

await browser.close()
