"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {

  const router = useRouter()

  const [loading,setLoading] = useState(true)
  const [user,setUser] = useState<any>(null)

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

  async function handleLogout(){

    await supabase.auth.signOut()

    router.push("/")

  }

  if(loading){
    return <p style={{padding:40}}>Loading dashboard...</p>
  }

  return (

    <main style={{padding:40}}>

      <h1>Dashboard</h1>

      <p>Welcome {user.email}</p>

      <p>Your monitoring system is ready.</p>

      <button
        onClick={handleLogout}
        style={{
          marginTop:20,
          padding:10,
          background:"#e63946",
          color:"white",
          border:"none",
          borderRadius:6,
          cursor:"pointer"
        }}
      >
        Log out
      </button>

    </main>

  )

}
