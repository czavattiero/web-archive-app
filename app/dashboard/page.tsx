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

  useEffect(()=>{

    async function init(){

      const { data } = await supabase.auth.getSession()

      if(!data.session){
        router.push("/login")
        return
      }

      const currentUser = data.session.user
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

      <div style={{display:"flex",justifyContent:"space-between",marginBottom:30}}>

        <h1>Dashboard</h1>

        <button
          onClick={handleLogout}
          style={{
            background:"#e74c3c",
            color:"white",
            border:"none",
            padding:"8px 14px",
            borderRadius:6,
            cursor:"pointer"
          }}
        >
          Sign out
        </button>

      </div>

      <h2>Add URL</h2>

      <form onSubmit={handleAddUrl} style={{marginBottom:40}}>

        <input
          type="text"
          placeholder="Paste full URL here"
          value={url}
          onChange={(e)=>setUrl(e.target.value)}
          style={{
            width:"100%",
            padding:10,
            marginBottom:10
          }}
        />

        <select
          value={schedule}
          onChange={(e)=>setSchedule(e.target.value)}
          style={{
            width:"100%",
            padding:10,
            marginBottom:10
          }}
        >
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>

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

      <h2>Tracked URLs</h2>

      <table style={{width:"100%",borderCollapse:"collapse"}}>

        <thead>

          <tr>

            <th style={{border:"1px solid #ddd",padding:10}}>URL</th>
            <th style={{border:"1px solid #ddd",padding:10}}>Schedule</th>
            <th style={{border:"1px solid #ddd",padding:10}}>Created</th>

          </tr>

        </thead>

        <tbody>

          {urls.length === 0 && (
            <tr>
              <td colSpan={3} style={{padding:10}}>No URLs yet</td>
            </tr>
          )}

          {urls.map((u)=>(

            <tr key={u.id}>

              <td style={{border:"1px solid #ddd",padding:10}}>
                {u.url}
              </td>

              <td style={{border:"1px solid #ddd",padding:10}}>
                {u.schedule_type}
              </td>

              <td style={{border:"1px solid #ddd",padding:10}}>
                {new Date(u.created_at).toLocaleString()}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </main>

  )

}
