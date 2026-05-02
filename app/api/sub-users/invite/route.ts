import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)

  if (callerError || !callerData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const callerId = callerData.user.id
  const { parentUserId, email } = await req.json()

  if (!parentUserId || !email) {
    return NextResponse.json({ error: "parentUserId and email are required" }, { status: 400 })
  }

  if (callerId !== parentUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
    const { data: inviteData, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { parent_user_id: parentUserId, needs_password_setup: true },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // The DB trigger does NOT fire for invited users — upsert the profile row.
    // profiles table has no created_at column so we don't include it.
    if (inviteData?.user?.id) {
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: inviteData.user.id,
            parent_user_id: parentUserId,
            email: email,
            plan: "basic",
            subscribed: false,
          },
          { onConflict: "id" }
        )
      if (upsertError) {
        console.warn("\u26a0\ufe0f Failed to create profile for invited sub-user:", upsertError.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("\u274c Invite error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
