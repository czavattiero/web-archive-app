const browser = await chromium.launch()

const page = await browser.newPage()

await page.goto(url.url, {
  waitUntil: "networkidle",
  timeout: 60000
})

const timestamp = new Date().toISOString().replace("T", " ").replace("Z", " UTC")

await page.addStyleTag({
  content: `
    body {
      margin-top: 90px !important;
    }

    #capture-header {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      background: white;
      color: black;
      font-size: 14px;
      font-family: Arial, sans-serif;
      padding: 10px;
      border-bottom: 2px solid #000;
      z-index: 999999;
      line-height: 1.4;
    }
  `
})

await page.evaluate((timestamp, url) => {

  const header = document.createElement("div")
  header.id = "capture-header"

  header.innerHTML = `
    <strong>Captured:</strong> ${timestamp}<br>
    <strong>URL:</strong> ${url}<br>
    <strong>System:</strong> WebArchive
  `

  document.body.prepend(header)

}, timestamp, url.url)

const pdfBuffer = await page.pdf({
  format: "A4",
  printBackground: true
})

await browser.close()
