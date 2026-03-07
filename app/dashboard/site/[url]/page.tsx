"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ArchivePage() {

  const [groupedCaptures, setGroupedCaptures] = useState<any>({})

  useEffect(() => {

    async function loadCaptures() {

      const { data, error } = await supabase
        .from("screenshot_jobs")
        .select("*")
        .eq("status", "complete")
        .order("created_at", { ascending: false })

      if (error) {
        console.error(error)
        return
      }

      const grouped: any = {}

      data?.forEach((job) => {
        if (!grouped[job.url]) {
          grouped[job.url] = []
        }
        grouped[job.url].push(job)
      })

      setGroupedCaptures(grouped)

    }

    loadCaptures()

  }, [])

  return (
    <div style={{ padding: "40px" }}>

      <h1 style={{ fontSize: "28px", marginBottom: "30px" }}>
        Archive Timeline
      </h1>

      {Object.keys(groupedCaptures).map((url) => (

        <div key={url} style={{ marginBottom: "40px" }}>

          <h2 style={{ marginBottom: "10px" }}>
            <a href={`/dashboard/site/${encodeURIComponent(url)}`}>
              {url}
            </a>
          </h2>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>

            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "8px" }}>
                  Captured
                </th>
                <th style={{ textAlign: "left", padding: "8px" }}>
                  PDF
                </th>
              </tr>
            </thead>

            <tbody>

              {groupedCaptures[url].map((job: any) => (

                <tr key={job.id}>

                  <td style={{ padding: "8px" }}>
                    {new Date(job.created_at).toLocaleString()}
                  </td>

                  <td style={{ padding: "8px" }}>
                    <a href={job.image_url} target="_blank">
                      Download PDF
                    </a>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      ))}

    </div>
  )

}
