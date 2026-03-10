"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function LoginPage() {

const router = useRouter()

const [email, setEmail] = useState("")
const [password, setPassword] = useState("")
const [loading, setLoading] = useState(false)

async function handleLogin(e:any){

e.preventDefault()

setLoading(true)

const { data, error } = await supabase.auth.signInWithPassword({
email,
password
})

if(error){
alert(error.message)
setLoading(false)
return
}

/* ensure user session exists */

if(data.user){
router.push("/dashboard")
}

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
