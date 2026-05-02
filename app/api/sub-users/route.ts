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

  const linkedProfiles: { id: string; created_at: string; email?: string }[] = profiles || []
  const linkedIds = new Set(linkedProfiles.map((p) => p.id))

  // Step 2: scan auth users whose metadata points to this parent (self-healing).
  // The Supabase DB trigger that creates profile rows does NOT fire for invited
  // users — so invited sub-users have no profiles row at all. We detect them
  // via user_metadata and upsert the full row here.
  try {
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
          // The profile row may not exist (trigger doesn't fire for invites).
          // Upsert with all required fields so this works whether or not the
          // row already exists.
          const { error: upsertError } = await supabaseAdmin
            .from("profiles")
            .upsert(
              {
                id: authUser.id,
                parent_user_id: userId,
                email: authUser.email ?? null,
                plan: "basic",
              },
              { onConflict: "id" }
            )

          if (upsertError) {
            console.warn("⚠️ Auto-repair upsert failed for sub-user", authUser.id, upsertError.message)
          }

          // Surface the user regardless of whether the DB write succeeded
          linkedProfiles.push({ id: authUser.id, created_at: authUser.created_at, email: authUser.email })
          linkedIds.add(authUser.id)
        }
      }

      if (authPage.users.length < perPage) break
      page++
    }
  } catch (scanErr) {
    const msg = scanErr instanceof Error ? scanErr.message : String(scanErr)
    console.warn("⚠️ Auth user scan failed (non-fatal):", msg)
  }

  // Step 3: resolve emails for all linked sub-users
  const subUsers = await Promise.all(
    linkedProfiles.map(async (profile) => {
      let email = profile.email || "(unknown)"
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
        if (userData?.user?.email) {
          email = userData.user.email
        }
      } catch {
        // keep existing email
      }
      return { id: profile.id, created_at: profile.created_at, email }
    })
  )

  return NextResponse.json({ subUsers })
}
