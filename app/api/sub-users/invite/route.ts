import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { parentUserId, email } = await req.json()

  if (!parentUserId || !email) {
    return NextResponse.json({ error: "parentUserId and email are required" }, { status: 400 })
  }

  // Verify the parent exists and is not itself a sub-user
  const { data: parentProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, parent_user_id")
    .eq("id", parentUserId)
    .maybeSingle()

  if (!parentProfile) {
    return NextResponse.json({ error: "Parent user not found" }, { status: 404 })
  }

  if (parentProfile.parent_user_id) {
    return NextResponse.json({ error: "Sub-users cannot invite other sub-users" }, { status: 403 })
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { parent_user_id: parentUserId },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ Invite error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
