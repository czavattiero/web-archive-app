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
  // Catches invited sub-users whose profiles.parent_user_id was never written
  // (e.g. because the invite upsert failed or a DB trigger reset it).
  try {
    let page = 1
    const perPage = 1000
    while (true) {
      const { data: authPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (!authPage?.users?.length) break

      for (const authUser of authPage.users) {
        if (
          authUser.user_metadata?.parent_user_id === userId &&
          !linkedIds.has(authUser.id)
        ) {
          // Auto-repair: write the missing parent_user_id link
          const { error: repairError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              { id: authUser.id, parent_user_id: userId, plan: "basic" },
              { onConflict: "id" }
            )
          if (!repairError) {
            linkedProfiles.push({
              id: authUser.id,
              created_at: authUser.created_at ?? new Date().toISOString(),
            })
            linkedIds.add(authUser.id)
          } else {
            console.warn("⚠️ Auto-repair failed for sub-user", authUser.id, repairError.message)
          }
        }
      }

      if (authPage.users.length < perPage) break
      page++
    }
  } catch (scanErr: any) {
    console.warn("⚠️ Auth user scan failed (non-fatal):", scanErr.message)
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
