import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, created_at")
    .eq("parent_user_id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const subUsers = await Promise.all(
    (profiles || []).map(async (profile: { id: string; created_at: string }) => {
      let email = "(unknown)"
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
        if (userData?.user?.email) {
          email = userData.user.email
        }
      } catch {
        // keep fallback email from profile row
      }
      return { id: profile.id, created_at: profile.created_at, email }
    })
  )

  return NextResponse.json({ subUsers })
}
