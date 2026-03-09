"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {

  const router = useRouter()
  const [loading,setLoading] = useState(true)

  useEffect(() => {

    async function loadUser(){

      const { data } = await supabase.auth.getUser()

      if(!data.user){
        router.push("/login")
        return
      }

      setLoading(false)

    }

    loadUser()

  },[])

  if(loading){
    return <p style={{padding:40}}>Loading dashboard...</p>
  }

  return (

    <main style={{padding:40}}>

      <h1>Dashboard</h1>

      <p>Your monitoring system is ready.</p>

    </main>

  )

}
