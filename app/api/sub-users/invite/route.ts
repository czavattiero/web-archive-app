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

    if (inviteData?.user?.id) {
      // Step 1: always write the parent_user_id link — this is critical for the
      // sub-user to appear on the dashboard at all.
      const { error: linkError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: inviteData.user.id, parent_user_id: parentUserId },
          { onConflict: "id" }
        )
      if (linkError) {
        console.warn("⚠️ Failed to link invited sub-user profile:", linkError.message)
      }

      // Step 2: try to store the email as well (requires the email column to exist).
      // This is best-effort — the sub-user will still appear even if this fails.
      try {
        await supabaseAdmin
          .from("profiles")
          .update({ email })
          .eq("id", inviteData.user.id)
      } catch (emailErr: any) {
        // email column may not exist yet; ignore
        console.warn("⚠️ Could not update email on profile (column may not exist yet):", emailErr?.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ Invite error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
