"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {

const router = useRouter()

const [loading,setLoading] = useState(true)
const [user,setUser] = useState<any>(null)

const [url,setUrl] = useState("")
const [schedule,setSchedule] = useState("weekly")
const [specificDate,setSpecificDate] = useState("")

const [urls,setUrls] = useState<any[]>([])
const [captures,setCaptures] = useState<any[]>([])

useEffect(()=>{

async function loadDashboard(){

const { data } = await supabase.auth.getUser()

if(!data.user){
router.push("/login")
return
}

setUser(data.user)

/* Load tracked URLs */

const { data:urlsData } = await supabase
.from("urls")
.select("*")
.eq("user_id",data.user.id)
.order("created_at",{ascending:false})

if(urlsData){
setUrls(urlsData)
}

/* Load captures belonging to this user */

const { data:capturesData } = await supabase
.from("captures")
.select(`
  id,
  captured_at,
  file_path,
  urls!inner (
    url,
    user_id
  )
`)
.eq("urls.user_id",data.user.id)
.order("captured_at",{ascending:false})

if(capturesData){
setCaptures(capturesData)
}

setLoading(false)

}

loadDashboard()

},[router])

async function addUrl(){

if(!url) return

/* insert URL */

const { data:newUrl } = await supabase
.from("urls")
.insert({
user_id:user.id,
url,
schedule_type:schedule
})
.select()
.single()

/* create screenshot job */

await fetch("/api/capture",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
url:url,
userId:user.id
})
})

setUrl("")
window.location.reload()

}

async function signOut(){

await supabase.auth.signOut()
router.push("/")

}

if(loading){
return <div style={{padding:"40px"}}>Loading dashboard...</div>
}

return (

<div style={{
padding:"40px",
fontFamily:"system-ui",
maxWidth:"1100px"
}}>

{/* Header */}

<div style={{display:"flex",justifyContent:"space-between"}}>

<div>
<h1 style={{fontSize:28}}>Dashboard</h1>
<p>Welcome {user.email}</p>
</div>

<button
onClick={signOut}
style={{
background:"#ef4444",
color:"white",
border:"none",
padding:"10px 16px",
borderRadius:6,
height:"40px",
cursor:"pointer"
}}
>
Sign Out
</button>

</div>

{/* Add URL Section */}

<div style={{marginTop:"40px",marginBottom:"50px"}}>

<h2>Add URL</h2>

<input
value={url}
onChange={(e)=>setUrl(e.target.value)}
placeholder="https://example.com/full-url"
style={{
width:"100%",
maxWidth:"800px",
padding:"12px",
marginTop:"10px",
marginBottom:"12px"
}}
/>

<select
value={schedule}
onChange={(e)=>setSchedule(e.target.value)}
style={{
padding:"10px",
display:"block",
marginBottom:"12px"
}}
>

<option value="weekly">Weekly</option>
<option value="biweekly">Biweekly</option>
<option value="29_days">Every 29 days</option>
<option value="30_days">Every 30 days</option>
<option value="specific_date">Specific Date</option>

</select>

{schedule === "specific_date" && (

<input
type="date"
value={specificDate}
onChange={(e)=>setSpecificDate(e.target.value)}
style={{
padding:"10px",
marginBottom:"12px",
display:"block"
}}
/>

)}

<button
onClick={addUrl}
style={{
padding:"10px 20px",
background:"#22c55e",
color:"white",
border:"none",
borderRadius:6,
cursor:"pointer"
}}
>
Add URL
</button>

</div>

{/* Tracked URLs */}

<div style={{marginBottom:"60px"}}>

<h2>Tracked URLs</h2>

<table style={{
width:"100%",
borderCollapse:"collapse",
marginTop:"10px"
}}>

<thead>

<tr style={{borderBottom:"1px solid #ddd"}}>
<th align="left">URL</th>
<th align="left">Schedule</th>
<th align="left">Created</th>
</tr>

</thead>

<tbody>

{urls.map((u)=>(
<tr key={u.id} style={{borderBottom:"1px solid #eee"}}>

<td>{u.url}</td>

<td>{u.schedule_type}</td>

<td>
{new Date(u.created_at).toLocaleDateString()}
</td>

</tr>
))}

</tbody>

</table>

</div>

{/* Capture History */}

<div>

<h2>Capture History</h2>

<table style={{
width:"100%",
borderCollapse:"collapse",
marginTop:"10px"
}}>

<thead>

<tr style={{borderBottom:"1px solid #ddd"}}>
<th align="left">URL</th>
<th align="left">Captured At</th>
<th align="left">PDF</th>
</tr>

</thead>

<tbody>

{captures.map((c)=>(
<tr key={c.id} style={{borderBottom:"1px solid #eee"}}>

<td>{c.urls?.url}</td>

<td>
{new Date(c.captured_at).toLocaleString()}
</td>

<td>
<a href={c.file_path} target="_blank">
Download
</a>
</td>

</tr>
))}

</tbody>

</table>

</div>

</div>

)

}
