import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  const { url, userId } = await req.json()

  const { data, error } = await supabase
    .from("screenshot_jobs")
    .insert([
      {
        user_id: userId,
        url: url,
        status: "pending"
      }
    ])
    .select()

  if (error) {
    return NextResponse.json({ error: error.message })
  }

  return NextResponse.json({
    job: data
  })
}
