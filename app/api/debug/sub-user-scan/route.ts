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

  const results: any = {
    userId,
    profilesQuery: null,
    authScan: [],
    upsertResults: [],
  }

  // Step 1: check profiles table
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, created_at, parent_user_id, email, plan")
    .eq("parent_user_id", userId)

  results.profilesQuery = { profiles, error: profilesError?.message ?? null }

  // Step 2: scan all auth users
  try {
    const { data: authPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError) {
      results.authScanError = listError.message
    } else {
      for (const u of authPage?.users ?? []) {
        const metaParent = u.user_metadata?.parent_user_id ?? (u as any).app_metadata?.parent_user_id
        results.authScan.push({
          id: u.id,
          email: u.email,
          user_metadata_parent: u.user_metadata?.parent_user_id ?? null,
          app_metadata_parent: (u as any).app_metadata?.parent_user_id ?? null,
          matchesUserId: metaParent === userId,
        })
      }
    }
  } catch (e: any) {
    results.authScanException = e.message
  }

  const matched = results.authScan.filter((u: any) => u.matchesUserId)
  results.matchedSubUsers = matched

  // Step 3: attempt upsert for each matched sub-user
  for (const u of matched) {
    const { error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: u.id,
          parent_user_id: userId,
          email: u.email ?? null,
          plan: "basic",
          subscribed: false,
        },
        { onConflict: "id" }
      )
    results.upsertResults.push({
      id: u.id,
      email: u.email,
      upsertError: upsertError?.message ?? null,
      upsertCode: upsertError?.code ?? null,
      upsertDetails: upsertError?.details ?? null,
    })
  }

  return NextResponse.json(results, { status: 200 })
}
