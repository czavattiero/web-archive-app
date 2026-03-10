"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {

const router = useRouter()

const [email, setEmail] = useState("")
const [password, setPassword] = useState("")
const [loading, setLoading] = useState(false)

/*
If user already logged in, go directly to dashboard
*/

useEffect(() => {

async function checkSession(){

const { data } = await supabase.auth.getUser()

if(data.user){
router.push("/dashboard")
}

}

checkSession()

}, [router])

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

router.push("/dashboard")

setLoading(false)

}

return (

<div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>

<form onSubmit={handleLogin} style={{width:"320px",display:"flex",flexDirection:"column",gap:"12px"}}>

<h1>Login</h1>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>

<button type="submit" disabled={loading}>
{loading ? "Logging in..." : "Login"}
</button>

</form>

</div>

)
}
