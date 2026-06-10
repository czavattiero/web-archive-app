import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUserFromRequest } from "../../../lib/server/billingAccess"
import { sanitizeLabel } from "../../../lib/labelUtils"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { urlId, label } = body

  if (!urlId) {
    return NextResponse.json({ error: "urlId is required" }, { status: 400 })
  }

  const safeLabel = sanitizeLabel(label)

  const { error } = await supabaseAdmin
    .from("urls")
    .update({ label: safeLabel })
    .eq("id", urlId)
    .eq("user_id", authUser.id)

  if (error) {
    console.error("❌ update-url-label error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ label: safeLabel })
}
