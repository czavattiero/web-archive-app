"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function SignupPage() {

  const params = useSearchParams()

  const plan = params.get("plan")

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")
  const [loading,setLoading] = useState(false)

  async function handleSignup(e:any){

    e.preventDefault()

    setLoading(true)

    try{

      // 1️⃣ create user
      const { error } = await supabase.auth.signUp({
        email,
        password
      })

      if(error){

        // if user already exists → try login
        if(error.message.includes("already registered")){

          const { error:loginError } =
            await supabase.auth.signInWithPassword({
              email,
              password
            })

          if(loginError){
            alert("User exists. Please log in.")
            setLoading(false)
            return
          }

        } else {

          alert(error.message)
          setLoading(false)
          return

        }

      }

      // 2️⃣ ensure session exists
      const { data:sessionData } = await supabase.auth.getSession()

      if(!sessionData.session){

        const { error:loginError } =
          await supabase.auth.signInWithPassword({
            email,
            password
          })

        if(loginError){
          alert("Login failed")
          setLoading(false)
          return
        }

      }

      // 3️⃣ start Stripe checkout
      const res = await fetch("/api/checkout",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          plan,
          email
        })
      })

      const data = await res.json()

      if(!data.url){
        alert("Stripe checkout failed")
        setLoading(false)
        return
      }

      // 4️⃣ redirect to Stripe
      window.location.href = data.url

    }catch(err){

      console.error(err)
      alert("Signup failed")

    }

    setLoading(false)

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

        <h1>Create your account</h1>

        <p style={{marginBottom:20}}>
          Selected plan: <strong>{plan}</strong>
        </p>

        <form onSubmit={handleSignup}>

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
            {loading ? "Creating..." : "Continue to payment"}
          </button>

        </form>

      </div>

    </main>

  )

}
