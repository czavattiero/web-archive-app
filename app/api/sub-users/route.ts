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
