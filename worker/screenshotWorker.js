const { chromium } = require("playwright")
const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runCapture(){

const { data:urls, error } = await supabase
.from("urls")
.select("*")

if(error){
console.log("Error loading URLs:",error)
return
}

if(!urls || urls.length === 0){
console.log("No URLs found")
return
}

for(const urlRow of urls){

console.log("Capturing:",urlRow.url)

try{

const browser = await chromium.launch()

const page = await browser.newPage()

await page.goto(urlRow.url,{
waitUntil:"networkidle"
})

/* Alberta timestamp */

const timestamp = new Date().toLocaleString("en-CA",{
timeZone:"America/Edmonton"
})

await page.evaluate((timestamp)=>{

const banner = document.createElement("div")

banner.innerText = "Captured: "+timestamp+" Alberta Time"

banner.style.position="fixed"
banner.style.top="0"
banner.style.left="0"
banner.style.right="0"
banner.style.background="white"
banner.style.color="black"
banner.style.fontSize="14px"
banner.style.padding="6px"
banner.style.zIndex="999999"
banner.style.borderBottom="1px solid #ccc"

document.body.prepend(banner)

},timestamp)

/* generate PDF */

const fileName = `${Date.now()}.pdf`
const filePath = path.join("/tmp",fileName)

await page.pdf({
path:filePath,
format:"A4"
})

await browser.close()

/* upload PDF to Supabase */

const fileBuffer = fs.readFileSync(filePath)

await supabase.storage
.from("captures")
.upload(fileName,fileBuffer,{
contentType:"application/pdf"
})

const publicUrl =
`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${fileName}`

/* insert capture record */

await supabase.from("captures").insert({

url_id:urlRow.id,
captured_at:new Date(),
file_path:publicUrl

})

console.log("Capture stored")

}catch(err){

console.log("Capture failed:",err)

}

}

}

runCapture()
