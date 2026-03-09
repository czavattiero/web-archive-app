"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {

  const router = useRouter()

  useEffect(() => {

    async function checkUser() {

      const { data } = await supabase.auth.getUser()

      if (!data.user) {
        router.push("/login")
      }

    }

    checkUser()

  }, [])

  return (

    <main style={{ padding: 40 }}>

      <h1>Dashboard</h1>

      <p>Your monitoring system is ready.</p>

    </main>

  )

}
