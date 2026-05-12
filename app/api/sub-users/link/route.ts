import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../../lib/server/billingAccess"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId, parentUserId } = await req.json()

  if (!userId || !parentUserId) {
    return NextResponse.json({ error: "userId and parentUserId are required" }, { status: 400 })
  }

  if (authUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parentBillingDecision = await getBillingAccessDecision(parentUserId)
  if (!parentBillingDecision.allowed) {
    return NextResponse.json({ error: "Parent account is not active" }, { status: 403 })
  }

  if (parentBillingDecision.userProfile?.parent_user_id) {
    return NextResponse.json({ error: "Cannot link to a sub-user" }, { status: 400 })
  }

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

  if (profile?.parent_user_id) {
    return NextResponse.json({ success: true })
  }

  let subUserEmail: string | undefined
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    subUserEmail = authUser?.user?.email
  } catch {
    // proceed without email
  }

  // profiles table has no created_at column — do not include it in upsert
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        parent_user_id: parentUserId,
        plan: "basic",
        subscribed: false,
        ...(subUserEmail ? { email: subUserEmail } : {}),
      },
      { onConflict: "id" }
    )

  if (error) {
    console.error("\u274c Link error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
