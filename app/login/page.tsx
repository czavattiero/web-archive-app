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

try{

const { error } = await supabase.auth.signInWithPassword({
email,
password
})

if(error){
alert(error.message)
setLoading(false)
return
}

/*
After successful login go to dashboard
*/

router.push("/dashboard")

}catch(err){

console.error(err)
alert("Login failed")

}

setLoading(false)

}

return (

<div className="flex items-center justify-center h-screen">

<form onSubmit={handleLogin} className="space-y-4 w-80">

<h1 className="text-xl font-bold text-center">
Login
</h1>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
className="w-full border p-2 rounded"
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
className="w-full border p-2 rounded"
/>

<button
type="submit"
disabled={loading}
className="w-full bg-indigo-600 text-white p-2 rounded"

>

{loading ? "Logging in..." : "Login"} </button>

</form>

</div>

)

}
