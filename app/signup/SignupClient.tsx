"use client"

import { useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function SignupClient({ plan }: { plan: string }) {

const [email, setEmail] = useState("")
const [password, setPassword] = useState("")
const [loading, setLoading] = useState(false)

async function handleSignup(e: React.FormEvent) {
e.preventDefault()

setLoading(true)

try {

const { error: signupError } = await supabase.auth.signUp({
email,
password
})

if (signupError) {
alert(signupError.message)
setLoading(false)
return
}

/*
Immediately sign the user in so a session exists
*/

const { data: loginData, error: loginError } =
await supabase.auth.signInWithPassword({
email,
password
})

if (loginError) {
alert(loginError.message)
setLoading(false)
return
}

const userId = loginData.user?.id

const response = await fetch("/api/checkout", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
plan,
email,
userId
})
})

const result = await response.json()

if (!result.url) {
alert("Stripe checkout failed")
setLoading(false)
return
}

window.location.href = result.url

} catch (err) {

console.error(err)
alert("Signup failed")

}

setLoading(false)
}

return (

<form onSubmit={handleSignup} className="space-y-4">

<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
className="w-full border p-2 rounded"
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
className="w-full border p-2 rounded"
/>

<button
type="submit"
disabled={loading}
className="w-full bg-indigo-600 text-white p-2 rounded"

>

{loading ? "Creating..." : "Create account"} </button>

</form>

)
}
