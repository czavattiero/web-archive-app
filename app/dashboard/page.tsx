"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard(){

  const router = useRouter()

  const [loading,setLoading] = useState(true)

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

  if(loading){
    return <p style={{padding:40}}>Loading dashboard...</p>
  }

  return(

    <main style={{padding:40,fontFamily:"system-ui"}}>

      <div style={{display:"flex",justifyContent:"space-between"}}>

        <h1>Dashboard</h1>

        <button
          onClick={handleLogout}
          style={{
            background:"#e74c3c",
            color:"white",
            border:"none",
            padding:"8px 14px",
            borderRadius:6
          }}
        >
          Sign out
        </button>

      </div>

      <p>Welcome to your dashboard.</p>

    </main>

  )

}
