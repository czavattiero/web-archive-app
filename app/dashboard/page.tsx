"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard(){

  const router = useRouter()

  const [loading,setLoading] = useState(true)

  const [url,setUrl] = useState("")
  const [schedule,setSchedule] = useState("weekly")

  useEffect(()=>{

    async function checkUser(){

      const { data } = await supabase.auth.getSession()

      if(!data.session){
        router.push("/login")
        return
      }

      setLoading(false)

    }

    checkUser()

  },[])

  async function handleLogout(){

    await supabase.auth.signOut()

    router.push("/")

  }

  function handleAddUrl(e:any){

    e.preventDefault()

    alert("URL added (database connection next)")

    setUrl("")

  }

  if(loading){
    return <p style={{padding:40}}>Loading dashboard...</p>
  }

  return (

    <main style={{fontFamily:"system-ui"}}>

      {/* NAVBAR */}

      <div
        style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          padding:"16px 40px",
          borderBottom:"1px solid #ddd"
        }}
      >

        <h2 style={{margin:0}}>Screenly</h2>

        <div style={{display:"flex",gap:20,alignItems:"center"}}>

          <span style={{cursor:"pointer"}}>Dashboard</span>
          <span style={{cursor:"pointer"}}>URLs</span>
          <span style={{cursor:"pointer"}}>Captures</span>
          <span style={{cursor:"pointer"}}>Billing</span>

          <button
            onClick={handleLogout}
            style={{
              padding:"6px 12px",
              background:"#e63946",
              color:"white",
              border:"none",
              borderRadius:6,
              cursor:"pointer"
            }}
          >
            Sign out
          </button>

        </div>

      </div>

      {/* PAGE CONTENT */}

      <div style={{padding:40}}>

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

        <h3>URL Capture History</h3>

        <p>No captures yet.</p>

      </div>

    </main>

  )

}
