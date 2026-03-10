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

/* load tracked URLs */

const { data:urlsData } = await supabase
.from("urls")
.select("*")
.eq("user_id",data.user.id)

if(urlsData){
setUrls(urlsData)
}

/* load captures */

const { data:capturesData } = await supabase
.from("captures")
.select("*")
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

await supabase.from("urls").insert({
user_id:user.id,
url,
schedule_type:schedule
})

window.location.reload()

}

if(loading){
return <div style={{padding:"40px"}}>Loading dashboard...</div>
}

return (

<div style={{padding:"40px",fontFamily:"system-ui"}}>

<h1 style={{fontSize:28}}>Dashboard</h1>

<p style={{marginBottom:30}}>
Welcome {user.email}
</p>

{/* ADD URL */}

<div style={{marginBottom:40}}>

<h2>Add URL</h2>

<input
value={url}
onChange={(e)=>setUrl(e.target.value)}
placeholder="https://example.com"
style={{
width:"400px",
padding:"10px",
marginRight:"10px"
}}
/>

<select
value={schedule}
onChange={(e)=>setSchedule(e.target.value)}
style={{padding:"10px"}}
>

<option value="weekly">Weekly</option>
<option value="biweekly">Biweekly</option>
<option value="29_days">Every 29 days</option>
<option value="30_days">Every 30 days</option>

</select>

<button
onClick={addUrl}
style={{
marginLeft:"10px",
padding:"10px 20px",
background:"#22c55e",
color:"white",
border:"none",
borderRadius:6
}}
>
Add URL
</button>

</div>

{/* TRACKED URLS */}

<div style={{marginBottom:50}}>

<h2>Tracked URLs</h2>

<table style={{width:"100%",borderCollapse:"collapse"}}>

<thead>
<tr>
<th align="left">URL</th>
<th align="left">Schedule</th>
<th align="left">Created</th>
</tr>
</thead>

<tbody>

{urls.map((u)=>(
<tr key={u.id}>
<td>{u.url}</td>
<td>{u.schedule_type}</td>
<td>{new Date(u.created_at).toLocaleDateString()}</td>
</tr>
))}

</tbody>

</table>

</div>

{/* CAPTURE HISTORY */}

<div>

<h2>Capture History</h2>

<table style={{width:"100%",borderCollapse:"collapse"}}>

<thead>
<tr>
<th align="left">URL</th>
<th align="left">Captured At</th>
<th align="left">PDF</th>
</tr>
</thead>

<tbody>

{captures.map((c)=>(
<tr key={c.id}>
<td>{c.url_id}</td>
<td>{new Date(c.captured_at).toLocaleString()}</td>
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
