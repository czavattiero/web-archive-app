"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function SuccessPage(){

  const router = useRouter()
  const params = useSearchParams()

  useEffect(()=>{

    const sessionId = params.get("session_id")

    if(!sessionId){
      router.push("/")
      return
    }

    async function verify(){

      const res = await fetch("/api/verify-session",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          sessionId
        })
      })

      const data = await res.json()

      if(!data.success){
        router.push("/")
        return
      }

      const { data:sessionData } = await supabase.auth.getSession()

      if(!sessionData.session){
        router.push("/login")
        return
      }

      router.push("/dashboard")

    }

    verify()

  },[params])

  return(

    <main
      style={{
        minHeight:"100vh",
        display:"flex",
        justifyContent:"center",
        alignItems:"center",
        fontFamily:"system-ui"
      }}
    >

      <h2>Payment successful. Loading dashboard...</h2>

    </main>

  )

}
