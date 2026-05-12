import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_PLANS = new Set(["trial", "basic", "pro"])

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? ""
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = authHeader.slice(7).trim()
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    userId?: string
    email?: string
    plan?: string
    trialEndsAt?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { userId, email, plan, trialEndsAt } = body
  if (!userId || !email || !plan || !trialEndsAt) {
    return NextResponse.json({ error: "userId, email, plan, and trialEndsAt are required" }, { status: 400 })
  }

  if (authData.user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!ALLOWED_PLANS.has(plan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        subscribed: false,
        plan,
        trial_ends_at: trialEndsAt,
      },
      { onConflict: "id" }
    )

  if (error) {
    console.error("Create profile upsert error:", { message: error.message, code: error.code })
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
