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

  useEffect(() => {

    async function loadUser(){

      const { data:sessionData } = await supabase.auth.getSession()

      if(sessionData.session){
        setUser(sessionData.session.user)
        setLoading(false)
        return
      }

      const { data:userData } = await supabase.auth.getUser()

      if(!userData.user){
        router.push("/login")
        return
      }

      setUser(userData.user)
      setLoading(false)

    }

    loadUser()

  },[router])

  // LOGOUT FUNCTION
  async function handleLogout(){

    await supabase.auth.signOut()

    router.push("/")

  }

  function handleAddUrl(e:any){

    e.preventDefault()

    if(!url){
      alert("Enter a URL")
      return
    }

    alert("URL added (backend connection comes later)")

    setUrl("")

  }

  if(loading){
    return <p style={{padding:40}}>Loading dashboard...</p>
  }

  return (

    <main style={{padding:40,fontFamily:"system-ui"}}>

      {/* Header */}
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

      {/* Tracked URLs */}
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

      {/* Capture History */}
      <h3>URL Capture History</h3>

      <p>No captures yet.</p>

    </main>

  )

}
