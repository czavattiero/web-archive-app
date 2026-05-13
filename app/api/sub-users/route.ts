import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  if (authUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const billingDecision = await getBillingAccessDecision(authUser.id)
  if (!billingDecision.allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  if (billingDecision.userProfile?.parent_user_id) {
    return NextResponse.json({ error: "Sub-users cannot list team members" }, { status: 403 })
  }

  // Step 1: get already-linked sub-users from profiles.
  // profiles table has no created_at column — select only id.
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("parent_user_id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const linkedIds = new Set((profiles || []).map((p: any) => p.id))

  // Step 2: scan auth users whose metadata points to this parent (self-healing).
  // The Supabase DB trigger does NOT fire for invited users, so invited
  // sub-users may have no profiles row. We detect and repair them here.
  const repairedUsers: { id: string; email: string; created_at: string }[] = []
  try {
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: authPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (listError) {
        console.warn("\u26a0\ufe0f Auth user list failed (non-fatal):", listError.message)
        break
      }
      if (!authPage?.users?.length) break

      for (const authUser of authPage.users) {
        const metaParent =
          authUser.user_metadata?.parent_user_id ??
          (authUser as any).app_metadata?.parent_user_id

        if (metaParent === userId && !linkedIds.has(authUser.id)) {
          const { error: upsertError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                id: authUser.id,
                parent_user_id: userId,
                email: authUser.email ?? null,
                plan: "basic",
                subscribed: false,
              },
              { onConflict: "id" }
            )

          if (upsertError) {
            console.warn("\u26a0\ufe0f Auto-repair upsert failed for sub-user", authUser.id, upsertError.message)
          }

          // Surface user regardless of whether DB write succeeded
          repairedUsers.push({
            id: authUser.id,
            email: authUser.email ?? "(unknown)",
            created_at: authUser.created_at,
          })
          linkedIds.add(authUser.id)
        }
      }

      if (authPage.users.length < perPage) break
      page++
    }
  } catch (scanErr) {
    const msg = scanErr instanceof Error ? scanErr.message : String(scanErr)
    console.warn("\u26a0\ufe0f Auth user scan failed (non-fatal):", msg)
  }

  // Step 3: resolve emails + created_at for all linked sub-users from auth
  const linkedProfileIds = (profiles || []).map((p: any) => p.id)
  const linkedSubUsers = await Promise.all(
    linkedProfileIds.map(async (id: string) => {
      let email = "(unknown)"
      let created_at = ""
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(id)
        if (userData?.user?.email) email = userData.user.email
        if (userData?.user?.created_at) created_at = userData.user.created_at
      } catch {
        // keep defaults
      }
      return { id, email, created_at }
    })
  )

  // Merge: repaired users first, then existing linked users (deduplicated)
  const repairedIds = new Set(repairedUsers.map((u) => u.id))
  const combined = [
    ...repairedUsers,
    ...linkedSubUsers.filter((u) => !repairedIds.has(u.id)),
  ]

  return NextResponse.json({ subUsers: combined })
}

export async function DELETE(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parentUserId: string | null = null
  let subUserId: string | null = null
  try {
    const body = await req.json()
    parentUserId = typeof body?.parentUserId === "string" ? body.parentUserId : null
    subUserId = typeof body?.subUserId === "string" ? body.subUserId : null
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!parentUserId || !subUserId) {
    return NextResponse.json({ error: "parentUserId and subUserId are required" }, { status: 400 })
  }

  if (authUser.id !== parentUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (parentUserId === subUserId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
  }

  const billingDecision = await getBillingAccessDecision(authUser.id)
  if (!billingDecision.allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  if (billingDecision.userProfile?.parent_user_id) {
    return NextResponse.json({ error: "Sub-users cannot delete team members" }, { status: 403 })
  }

  const { data: subUserProfile } = await supabaseAdmin
    .from("profiles")
    .select("parent_user_id")
    .eq("id", subUserId)
    .maybeSingle()

  const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(subUserId)
  if (authUserError || !authUserData?.user) {
    return NextResponse.json({ error: "Sub-user not found" }, { status: 404 })
  }

  const metadataParentUserId =
    authUserData.user.user_metadata?.parent_user_id ??
    (authUserData.user as any).app_metadata?.parent_user_id

  if (subUserProfile?.parent_user_id !== parentUserId && metadataParentUserId !== parentUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: storageCaptureRows } = await supabaseAdmin
    .from("captures")
    .select("file_path")
    .eq("user_id", subUserId)
    .not("file_path", "is", null)

  const filePaths = Array.from(
    new Set(
      (storageCaptureRows || [])
        .map((row: any) => row.file_path)
        .filter((value: unknown): value is string => typeof value === "string" && value.length > 0)
    )
  )
  if (filePaths.length > 0) {
    const { error: storageDeleteError } = await supabaseAdmin.storage
      .from("captures")
      .remove(filePaths)
    if (storageDeleteError) {
      console.warn("⚠️ Failed to remove some sub-user capture files:", storageDeleteError.message)
    }
  }

  const { error: capturesDeleteError } = await supabaseAdmin
    .from("captures")
    .delete()
    .eq("user_id", subUserId)
  if (capturesDeleteError) {
    return NextResponse.json({ error: capturesDeleteError.message }, { status: 500 })
  }

  const { error: urlsDeleteError } = await supabaseAdmin
    .from("urls")
    .delete()
    .eq("user_id", subUserId)
  if (urlsDeleteError) {
    return NextResponse.json({ error: urlsDeleteError.message }, { status: 500 })
  }

  const { error: profileDeleteError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", subUserId)
  if (profileDeleteError) {
    return NextResponse.json({ error: profileDeleteError.message }, { status: 500 })
  }

  const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(subUserId)
  if (deleteUserError) {
    return NextResponse.json({ error: deleteUserError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
