"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Dashboard() {
  const [url, setUrl] = useState("")
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [selectedUrlId, setSelectedUrlId] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: urlsData } = await supabase.from("urls").select("*")

    const { data: capturesData } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    setUrls(urlsData || [])
    setCaptures(capturesData || [])
  }

  async function addUrl() {
    if (!url) return

    await supabase.from("urls").insert([
      {
        url,
        schedule_type: "daily",
        next_capture_at: new Date().toISOString(),
      },
    ])

    setUrl("")
    fetchData()
  }

  // 🔥 MAP URL DATA
  const urlMap = Object.fromEntries(urls.map((u) => [u.id, u]))

  const filteredCaptures = selectedUrlId
    ? captures.filter((c) => c.url_id === selectedUrlId)
    : captures

  return (
    <div style={layout}>
      {/* SIDEBAR */}
      <div style={sidebar}>
        <h2 style={logo}>WebArchive</h2>
        <div style={menuItemActive}>Dashboard</div>
        <div style={menuItem}>URLs</div>
        <div style={menuItem}>Captures</div>
      </div>

      {/* MAIN */}
      <div style={main}>
        <h1 style={title}>Dashboard</h1>

        {/* ADD URL */}
        <div style={card}>
          <h3>Add URL</h3>
          <div style={row}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              style={input}
            />
            <button onClick={addUrl} style={button}>
              Add URL
            </button>
          </div>
        </div>

        {/* URL LIST */}
        <div style={card}>
          <h3>Tracked URLs</h3>

          {urls.map((u) => (
            <div
              key={u.id}
              onClick={() => setSelectedUrlId(u.id)}
              style={{
                ...urlItem,
                ...(selectedUrlId === u.id ? urlItemActive : {}),
              }}
            >
              🔗 {u.url}
            </div>
          ))}
        </div>

        {/* CAPTURE HISTORY TABLE */}
        <div style={card}>
          <h3>Capture History</h3>

          <table style={table}>
            <thead>
              <tr>
                <th style={th}>URL</th>
                <th style={th}>Status</th>
                <th style={th}>Schedule</th>
                <th style={th}>PDF</th>
              </tr>
            </thead>

            <tbody>
              {filteredCaptures.length === 0 ? (
                <tr>
                  <td col
