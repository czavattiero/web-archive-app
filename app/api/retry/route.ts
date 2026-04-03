import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { urlId } = await req.json()

  if (!urlId) {
    return NextResponse.json({ error: "Missing urlId" }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { error } = await supabase
    .from("urls")
    .update({
      status: "active",
      retry_count: 0,
      next_capture_at: now,
    })
    .eq("id", urlId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
