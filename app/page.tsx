"use client"

import { useRouter } from "next/navigation"

export default function Home() {

  const router = useRouter()

  return (

    <main style={{textAlign:"center", padding:"80px"}}>

      <h1>Screenly</h1>

      <h2>Because you have more important things to do</h2>

      <p>
        Screenly allows you to automate the captures of URLs and schedule
        future captures. The PDFs can then be downloaded.
      </p>

      <div style={{marginTop:"40px"}}>

        <button onClick={()=>router.push("/signup")}>
          Basic Plan
        </button>

        <button
          onClick={()=>router.push("/signup")}
          style={{marginLeft:"20px"}}
        >
          Professional Plan
        </button>

      </div>

      <div style={{marginTop:"40px"}}>

        <button onClick={()=>router.push("/login")}>
          Log in
        </button>

      </div>

    </main>

  )
}
