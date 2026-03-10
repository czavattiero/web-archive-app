"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

export default function Dashboard() {

const router = useRouter()

const [loading, setLoading] = useState(true)
const [user, setUser] = useState<any>(null)

useEffect(() => {

async function loadSession() {

const { data, error } = await supabase.auth.getUser()

if(error){
console.error(error)
router.push("/login")
return
}

if(!data.user){
router.push("/login")
return
}

setUser(data.user)
setLoading(false)

}

loadSession()

}, [router])

if(loading){
return <div style={{padding:"40px"}}>Loading dashboard...</div>
}

return (

<div style={{padding:"40px"}}>

<h1>Dashboard</h1>

<p>Welcome {user.email}</p>

</div>

)

}
