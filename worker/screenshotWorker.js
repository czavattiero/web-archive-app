const browser = await chromium.launch()

const page = await browser.newPage()

await page.goto(url.url, {
  waitUntil: "networkidle",
  timeout: 60000
})

const timestamp = new Date().toISOString()

await page.addStyleTag({
  content: `
    body {
      margin-top: 60px !important;
    }

    #capture-timestamp {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background: white;
      color: black;
      font-size: 14px;
      font-family: Arial, sans-serif;
      padding: 10px;
      border-bottom: 1px solid #ccc;
      z-index: 999999;
      text-align: center;
    }
  `
})

await page.evaluate((timestamp) => {

  const banner = document.createElement("div")
  banner.id = "capture-timestamp"

  banner.innerText = "Captured: " + timestamp

  document.body.prepend(banner)

}, timestamp)

const pdfBuffer = await page.pdf({
  format: "A4",
  printBackground: true
})

await browser.close()
