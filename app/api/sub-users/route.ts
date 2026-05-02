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

  const linkedIds = new Set((profiles || []).map((p: any) => p.id))

  // Step 2: scan auth users whose metadata points to this parent (self-healing)
  // This catches invited sub-users whose profile link was never written
  try {
    const usersToRepair: { id: string; created_at: string }[] = []
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: authPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (listError) throw listError
      if (!authPage?.users?.length) break

      for (const authUser of authPage.users) {
        if (
          authUser.user_metadata?.parent_user_id === userId &&
          !linkedIds.has(authUser.id)
        ) {
          usersToRepair.push({ id: authUser.id, created_at: authUser.created_at })
        }
      }

      if (authPage.users.length < perPage) break
      page++
    }

    if (usersToRepair.length > 0) {
      // Batch upsert all missing links in a single DB call.
      // Include plan: "basic" to satisfy any NOT NULL constraint on the plan column.
      const { error: repairError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          usersToRepair.map((u) => ({ id: u.id, parent_user_id: userId, plan: "basic" })),
          { onConflict: "id" }
        )
      if (!repairError) {
        for (const u of usersToRepair) {
          ;(profiles as any[]).push(u)
          linkedIds.add(u.id)
        }
      } else {
        console.warn("⚠️ Auto-repair batch upsert failed:", repairError.message)
      }
    }
  } catch (scanErr: any) {
    console.warn("⚠️ Auth user scan failed (non-fatal):", scanErr.message)
  }

  // Step 3: resolve emails for all linked sub-users
  const subUsers = await Promise.all(
    (profiles || []).map(async (profile: { id: string; created_at: string }) => {
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
