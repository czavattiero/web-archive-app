"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {

  const [urls, setUrls] = useState([])
  const [urlInput, setUrlInput] = useState("")
  const [schedule, setSchedule] = useState(7)
  const [customDate, setCustomDate] = useState("")

  useEffect(() => {
    loadUrls()
  }, [])

  async function loadUrls() {

    const { data } = await supabase
      .from("urls")
      .select("*")

    if (data) setUrls(data)
  }

  async function addUrl() {

    let nextCapture = null

    if (schedule === 0 && customDate) {
      nextCapture = new Date(customDate)
    }

    const { error } = await supabase
      .from("urls")
      .insert({
        url: urlInput,
        schedule_value: schedule,
        next_capture_at: nextCapture
      })

    if (error) {
      alert(error.message)
      return
    }

    setUrlInput("")
    loadUrls()
  }

  async function captureNow(url) {

    const { error } = await supabase
      .from("screenshot_jobs")
      .insert({
        url: url,
        status: "pending"
      })

    if (error) {
      alert(error.message)
      return
    }

    alert("Capture started")
  }

  return (

    <div style={{ padding: "40px", fontFamily: "Arial" }}>

      <h2>Tracked URLs</h2>

      <input
        placeholder="https://example.com"
        value={urlInput}
        onChange={(e)=>setUrlInput(e.target.value)}
      />

      <select
        value={schedule}
        onChange={(e)=>setSchedule(Number(e.target.value))}
      >

        <option value={7}>Weekly</option>
        <option value={14}>Biweekly</option>
        <option value={29}>Every 29 days</option>
        <option value={30}>Every 30 days</option>
        <option value={60}>Every 60 days</option>
        <option value={0}>Specific date</option>

      </select>

      {schedule === 0 && (
        <input
          type="datetime-local"
          value={customDate}
          onChange={(e)=>setCustomDate(e.target.value)}
        />
      )}

      <button onClick={addUrl}>
        Add URL
      </button>

      <hr style={{margin:"30px 0"}}/>

      <table>

        <thead>
          <tr>
            <th>URL</th>
            <th>Capture</th>
            <th>History</th>
          </tr>
        </thead>

        <tbody>

          {urls.map((item)=>(
            <tr key={item.id}>

              <td>{item.url}</td>

              <td>
                <button onClick={()=>captureNow(item.url)}>
                  Capture Now
                </button>
              </td>

              <td>
                <a href="/dashboard/archive">
                  View History
                </a>
              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </div>
  )
}
