"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [captures, setCaptures] = useState<any[]>([])

  useEffect(() => {
    async function fetchCaptures() {
      console.log("🚀 Fetching captures...")

      const { data, error } = await supabase
        .from("captures")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("❌ Fetch error:", error)
      } else {
        console.log("✅ Data received:", data)
        setCaptures(data || [])
      }
    }

    fetchCaptures()
  }, [])

  return (
    <div style={{ padding: "20px" }}>
      <h1>DEBUG CAPTURES</h1>

      <p>Total records: {captures.length}</p>

      <pre style={{ background: "#111", color: "#0f0", padding: "10px" }}>
        {JSON.stringify(captures, null, 2)}
      </pre>
    </div>
  )
}
