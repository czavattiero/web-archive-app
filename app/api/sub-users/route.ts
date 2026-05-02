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

  // Step 1: get already-linked sub-users from profiles
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, created_at")
    .eq("parent_user_id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const linkedProfiles: { id: string; created_at: string }[] = profiles || []
  const linkedIds = new Set(linkedProfiles.map((p) => p.id))

  // Step 2: scan auth users whose metadata points to this parent (self-healing).
  // inviteUserByEmail stores data in user_metadata, but depending on the Supabase
  // version / flow it may surface on the admin API under app_metadata instead.
  // We check both to be safe.
  try {
    const usersToRepair: { id: string; created_at: string }[] = []
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: authPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (listError) {
        console.warn("⚠️ Auth user list failed (non-fatal):", listError.message)
        break
      }
      if (!authPage?.users?.length) break

      for (const authUser of authPage.users) {
        const metaParent =
          authUser.user_metadata?.parent_user_id ??
          (authUser as any).app_metadata?.parent_user_id

        if (metaParent === userId && !linkedIds.has(authUser.id)) {
          usersToRepair.push({ id: authUser.id, created_at: authUser.created_at })
        }
      }

      if (authPage.users.length < perPage) break
      page++
    }

    // Repair each user with UPDATE so we only patch parent_user_id without
    // risking NOT NULL violations on other columns.
    for (const u of usersToRepair) {
      const { error: repairError } = await supabaseAdmin
        .from("profiles")
        .update({ parent_user_id: userId })
        .eq("id", u.id)
      if (!repairError) {
        linkedProfiles.push(u)
        linkedIds.add(u.id)
      } else {
        console.warn("⚠️ Auto-repair UPDATE failed for sub-user", u.id, repairError.message)
        // Still surface the user even if the DB repair failed — the email
        // lookup in Step 3 will work as long as the auth user exists.
        linkedProfiles.push(u)
        linkedIds.add(u.id)
      }
    }
  } catch (scanErr) {
    const msg = scanErr instanceof Error ? scanErr.message : String(scanErr)
    console.warn("⚠️ Auth user scan failed (non-fatal):", msg)
  }

  // Step 3: resolve emails for all linked sub-users
  const subUsers = await Promise.all(
    linkedProfiles.map(async (profile) => {
      let email = "(unknown)"
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
        if (userData?.user?.email) {
          email = userData.user.email
        }
      } catch {
        // keep "(unknown)"
      }
      return { id: profile.id, created_at: profile.created_at, email }
    })
  )

  return NextResponse.json({ subUsers })
}
