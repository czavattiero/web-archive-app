import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  // Verify the caller's identity via the Bearer token so that sub-users
  // cannot bypass the restriction by supplying a different parentUserId.
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

  // The authenticated caller must be the parentUserId supplied in the body.
  if (callerId !== parentUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
    // Redirect invitees to /set-password instead of /dashboard so they are
    // required to create a password before accessing the app. The
    // needs_password_setup flag is read by both the set-password page and the
    // dashboard guard to enforce this one-time step.
    const { data: inviteData, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { parent_user_id: parentUserId, needs_password_setup: true },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // At invite time the profile row may not exist yet (Supabase creates it via
    // a DB trigger only after the user accepts and signs in). We attempt an
    // UPDATE here so we only patch parent_user_id without risking NOT NULL
    // violations. If the row doesn't exist yet the UPDATE is a no-op and the
    // self-healing scan in GET /api/sub-users will repair it on the parent's
    // next dashboard load after the sub-user has signed in.
    if (inviteData?.user?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ parent_user_id: parentUserId })
        .eq("id", inviteData.user.id)
      if (updateError) {
        console.warn("⚠️ Failed to pre-link profile for invited sub-user:", updateError.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ Invite error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
