"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {

  const router = useRouter()

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  async function handleLogin(e:any){

    e.preventDefault()

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if(error){

      alert(error.message)
      setLoading(false)
      return

    }

    // redirect to dashboard after login
    router.push("/dashboard")

  }

  return(

    <main
      style={{
        minHeight:"100vh",
        display:"flex",
        justifyContent:"center",
        alignItems:"center",
        background:"#f7f8fb",
        fontFamily:"system-ui"
      }}
    >

      <div
        style={{
          background:"white",
          padding:40,
          borderRadius:12,
          width:400,
          boxShadow:"0 10px 30px rgba(0,0,0,0.1)"
        }}
      >

        <h1 style={{marginBottom:20}}>
          Log in
        </h1>

        <form onSubmit={handleLogin}>

          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            style={{
              width:"100%",
              padding:12,
              marginBottom:12,
              borderRadius:6,
              border:"1px solid #ddd"
            }}
          />

          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            style={{
              width:"100%",
              padding:12,
              marginBottom:20,
              borderRadius:6,
              border:"1px solid #ddd"
            }}
          />

          <button
            type="submit"
            style={{
              width:"100%",
              padding:12,
              background:"#5B4DFF",
              color:"white",
              border:"none",
              borderRadius:8,
              cursor:"pointer",
              fontWeight:600
            }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>

        </form>

      </div>

    </main>
  )
}
