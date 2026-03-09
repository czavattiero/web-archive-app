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
      alert("Please enter a URL")
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
          Sign out
        </button>

      </div>

      {/* ADD URL */}

      <h2>Add URL to Track</h2>

      <form onSubmit={handleAddUrl} style={{marginBottom:40}}>

        <input
          type="text"
          placeholder="Paste full URL here (https://example.com/page)"
          value={url}
          onChange={(e)=>setUrl(e.target.value)}
          style={{
            width:"100%",
            padding:10,
            marginBottom:10,
            border:"1px solid #ccc",
            borderRadius:4
          }}
        />

        <div style={{marginBottom:10}}>

          <label>Capture schedule</label>

          <select
            value={schedule}
            onChange={(e)=>setSchedule(e.target.value)}
            style={{
              width:"100%",
              padding:8,
              marginTop:5
            }}
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>

        </div>

        <button
          type="submit"
          style={{
            background:"#2ecc71",
            color:"white",
            padding:"10px 20px",
            border:"none",
            borderRadius:5,
            cursor:"pointer"
          }}
        >
          Add URL
        </button>

      </form>

      {/* URL TABLE */}

      <h2>Tracked URLs</h2>

      <table
        style={{
          width:"100%",
          borderCollapse:"collapse",
          marginBottom:40
        }}
      >

        <thead>

          <tr style={{background:"#f5f5f5"}}>

            <th style={{padding:10,border:"1px solid #ddd"}}>URL</th>
            <th style={{padding:10,border:"1px solid #ddd"}}>Schedule</th>
            <th style={{padding:10,border:"1px solid #ddd"}}>Created</th>

          </tr>

        </thead>

        <tbody>

          {urls.length === 0 && (
            <tr>
              <td colSpan={3} style={{padding:10}}>
                No URLs added yet
              </td>
            </tr>
          )}

          {urls.map((u)=>(
            <tr key={u.id}>

              <td style={{padding:10,border:"1px solid #ddd"}}>
                {u.url}
              </td>

              <td style={{padding:10,border:"1px solid #ddd"}}>
                {u.schedule_type}
              </td>

              <td style={{padding:10,border:"1px solid #ddd"}}>
                {new Date(u.created_at).toLocaleString()}
              </td>

            </tr>
          ))}

        </tbody>

      </table>

      {/* CAPTURE TABLE */}

      <h2>Capture History</h2>

      <table
        style={{
          width:"100%",
          borderCollapse:"collapse"
        }}
      >

        <thead>

          <tr style={{background:"#f5f5f5"}}>

            <th style={{padding:10,border:"1px solid #ddd"}}>URL</th>
            <th style={{padding:10,border:"1px solid #ddd"}}>Captured At</th>
            <th style={{padding:10,border:"1px solid #ddd"}}>Status</th>
            <th style={{padding:10,border:"1px solid #ddd"}}>PDF</th>

          </tr>

        </thead>

        <tbody>

          <tr>
            <td colSpan={4} style={{padding:10}}>
              No captures yet
            </td>
          </tr>

        </tbody>

      </table>

    </main>

  )

}
