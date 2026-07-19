import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAccountUserIds, getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const billingDecision = await getBillingAccessDecision(authUser.id)
  if (!billingDecision.allowed || !billingDecision.ownerId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const { urlId } = await req.json()
  if (!urlId) {
    return NextResponse.json({ error: "Missing urlId" }, { status: 400 })
  }

  const accountUserIds = await getAccountUserIds(billingDecision.ownerId)
  const { data: existingUrl, error: existingUrlError } = await supabase
    .from("urls")
    .select("id, user_id, status")
    .eq("id", urlId)
    .maybeSingle()

  if (existingUrlError) {
    return NextResponse.json({ error: existingUrlError.message }, { status: 500 })
  }

  if (!existingUrl) {
    return NextResponse.json({ error: "URL not found" }, { status: 404 })
  }

  if (!accountUserIds.includes(existingUrl.user_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (existingUrl.status === "deleted") {
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase
    .from("urls")
    .update({
      status: "deleted",
      next_capture_at: null,
    })
    .eq("id", urlId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
