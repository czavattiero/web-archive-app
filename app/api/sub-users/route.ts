import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.ca>"

function buildAccountDeletedEmailHtml(): string {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#6A11CB,#FF7A00);display:inline-block;padding:12px 28px;border-radius:12px;">
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Timedshot</span>
    </div>
  </div>
  <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111;">Your Timedshot account has been removed</h2>
  <p style="font-size:15px;color:#555;margin-bottom:16px;">
    Your Timedshot account has been removed by the account holder.
  </p>
  <p style="font-size:15px;color:#555;margin-bottom:16px;">
    All your archived URLs and captures associated with this account have been deleted.
  </p>
  <p style="font-size:15px;color:#555;margin-bottom:28px;">
    If you'd like to continue using Timedshot, you can sign up for a new account at
    <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://timedshot.ca"}" style="color:#6A11CB;">${process.env.NEXT_PUBLIC_SITE_URL || "https://timedshot.ca"}</a>.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <p style="font-size:12px;color:#aaa;text-align:center;">
    This is an automated message from Timedshot. Please do not reply to this email.
  </p>
</div>`
}

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
      return NextResponse.json(
        {
          error: storageDeleteError.message,
          step: "storage_cleanup",
          retryable: true,
        },
        { status: 500 }
      )
    }
  }

  const { error: capturesDeleteError } = await supabaseAdmin
    .from("captures")
    .delete()
    .eq("user_id", subUserId)
  if (capturesDeleteError) {
    return NextResponse.json(
      { error: capturesDeleteError.message, step: "captures_delete", retryable: true },
      { status: 500 }
    )
  }

  const { error: urlsDeleteError } = await supabaseAdmin
    .from("urls")
    .delete()
    .eq("user_id", subUserId)
  if (urlsDeleteError) {
    return NextResponse.json(
      { error: urlsDeleteError.message, step: "urls_delete", retryable: true },
      { status: 500 }
    )
  }

  const { error: profileDeleteError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", subUserId)
  if (profileDeleteError) {
    return NextResponse.json(
      { error: profileDeleteError.message, step: "profile_delete", retryable: true },
      { status: 500 }
    )
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const subUserEmail = authUserData.user.email
      if (subUserEmail) {
        const { error: emailError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: subUserEmail,
          subject: "Your Timedshot account has been removed",
          html: buildAccountDeletedEmailHtml(),
        })
        if (emailError) {
          console.error("Failed to send account deletion email:", JSON.stringify(emailError))
        } else {
          console.log(`✉️ Account deletion email sent to ${subUserEmail}`)
        }
      }
    } catch (emailErr: any) {
      console.error("Error sending account deletion email:", emailErr.message)
    }
  } else {
    console.warn("⚠️ RESEND_API_KEY not set — skipping account deletion email")
  }

  const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(subUserId)
  if (deleteUserError) {
    return NextResponse.json(
      { error: deleteUserError.message, step: "auth_delete", retryable: true },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
