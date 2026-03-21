"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function DashboardPage() {

  const [user, setUser] = useState<any>(null)
  const [urls, setUrls] = useState<any[]>([])
  const [captures, setCaptures] = useState<any[]>([])
  const [newUrl, setNewUrl] = useState("")
  const [schedule, setSchedule] = useState("weekly")

  // ✅ FETCH URLS
  async function fetchUrls(userId: string) {
    const { data } = await supabase
      .from("urls")
      .select("*")
      .eq("user_id", userId)

    setUrls(data || [])
  }

  // ✅ FINAL FIXED FETCH CAPTURES
  async function fetchCaptures(userId: string) {

    // 1. get user's urls
    const { data: userUrls } = await supabase
      .from("urls")
      .select("id, url")
      .eq("user_id", userId)

    if (!userUrls) return

    const urlMap = new Map(userUrls.map(u => [u.id, u.url]))
    const urlIds = new Set(userUrls.map(u => u.id))

    // 2. get ALL captures (NO FILTER)
    const { data: allCaptures } = await supabase
      .from("captures")
      .select("*")
      .order("created_at", { ascending: false })

    if (!
