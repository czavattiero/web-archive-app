"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {

const router = useRouter()

const [loading, setLoading] = useState(true)
const [user, setUser] = useState<any>(null)

useEffect(() => {

async function loadUser() {

const { data } = await supabase.auth.getUser()

if (!data.user) {
router.push("/")
return
}

setUser(data.user)

const { data: sub } = await supabase
.from("subscriptions")
.select("*")
.eq("user_id", data.user.id)
.single()

if (!sub) {
router.push("/")
return
}

setLoading(false)

}

loadUser()

}, [router])

if (loading) {
return <div className="p-8">Loading dashboard...</div>
}

return (

<div className="p-8">

<h1 className="text-2xl font-bold mb-6">
Dashboard
</h1>

<p className="mb-6">
Welcome {user.email}
</p>

</div>

)

}
