"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard(){

  const router = useRouter()

  const [loading,setLoading] = useState(true)
  const [user,setUser] = useState<any>(null)

  const [url,setUrl] = useState("")
  const [schedule,setSchedule] = useState("weekly")

  const [urls,setUrls] = useState<any[]>([])

  useEffect(()=>{

    async function init(){

      const { data:sessionData } = await supabase.auth.getSession()

      if(!sessionData.session){
        router.push("/login")
        return
      }

      const currentUser = sessionData.session.user
      setUser(currentUser)

      await loadUrls(currentUser.id)

      setLoading(false)

    }

    init()

  },[])

  async function loadUrls(userId:string){

    const { data } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id",userId)
      .order("created_at",{ascending:false})

    if(data){
      setUrls(data)
    }

  }

  async function handleAddUrl(e:any){

    e.preventDefault()

    if(!url){
      alert("Enter a URL")
      return
    }

    const { error } = await supabase
      .from("urls")
      .insert({
        user_id:user.id,
        url:url,
        schedule_type:schedule
      })

    if(error){
      alert(error.message)
      return
    }

    setUrl("")

    await loadUrls(user.id)

  }

  async function handleLogout(){

    await supabase.auth.signOut()

    router.push("/")

  }

  if(loading){
    return <p style={{padding:40}}>Loading dashboard...</p>
  }

  return(

    <main style={{padding:40,fontFamily:"system-ui"}}>

      {/* HEADER */}
      <div
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          marginBottom:30
        }}
      >
        <h1>Dashboard</h1>

        <button
          onClick={handleLogout}
          style={{
            padding:"8px 14px",
            background:"#e63946",
            color:"white",
            border:"none",
            borderRadius:6,
            cursor:"pointer"
          }}
        >
          Log out
        </button>
      </div>

      {/* TRACKED URLS */}

      <h2>Tracked URLs</h2>

      <form onSubmit={handleAddUrl} style={{marginBottom:30}}>

        <input
          type="text"
          placeholder="https://example.com"
          value={url}
          onChange={(e)=>setUrl(e.target.value)}
          style={{
            padding:8,
            width:250,
            marginRight:10
          }}
        />

        <select
          value={schedule}
          onChange={(e)=>setSchedule(e.target.value)}
          style={{padding:8,marginRight:10}}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="hourly">Hourly</option>
        </select>

        <button type="submit">
          Add URL
        </button>

      </form>

      <hr style={{margin:"30px 0"}}/>

      {/* URL LIST */}

      <h3>Your URLs</h3>

      {urls.length === 0 && <p>No URLs yet.</p>}

      {urls.map((u)=>(
        <div key={u.id} style={{marginBottom:10}}>
          {u.url} — {u.schedule_type}
        </div>
      ))}

      <hr style={{margin:"30px 0"}}/>

      <h3>URL Capture History</h3>

      <p>No captures yet.</p>

    </main>

  )

}
