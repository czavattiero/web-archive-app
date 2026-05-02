import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId, parentUserId } = await req.json()

  if (!userId || !parentUserId) {
    return NextResponse.json({ error: "userId and parentUserId are required" }, { status: 400 })
  }

  // Verify parent exists and is not itself a sub-user
  const { data: parentProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, parent_user_id")
    .eq("id", parentUserId)
    .maybeSingle()

  if (!parentProfile) {
    return NextResponse.json({ error: "Parent not found" }, { status: 404 })
  }

  if (parentProfile.parent_user_id) {
    return NextResponse.json({ error: "Cannot link to a sub-user" }, { status: 400 })
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("parent_user_id")
    .eq("id", userId)
    .maybeSingle()

  // Already linked — nothing to do
  if (profile?.parent_user_id) {
    return NextResponse.json({ success: true })
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, parent_user_id: parentUserId },
      { onConflict: "id" }
    )

  if (error) {
    console.error("❌ Link error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
