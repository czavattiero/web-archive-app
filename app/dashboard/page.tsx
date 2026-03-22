"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [captures, setCaptures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCaptures() {
      console.log("🚀 Fetching captures...")

      const { data, error } = await supabase
        .from("captures")
        .select("*")
        .order("created_at", { ascending: false })

      console.log("DATA:", data)

      if (!error) setCaptures(data || [])
      setLoading(false)
    }

    fetchCaptures()
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div style={{ padding: 20 }}>
      <h1>Captures</h1>

      {captures.length === 0 && <p>No captures found</p>}

      {captures.map((c) => {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/captures/${c.file_path}`

        return (
          <div key={c.id}>
            <p>{c.file_path}</p>
            <a href={url} target="_blank">View PDF</a>
          </div>
        )
      })}
    </div>
  )
}
