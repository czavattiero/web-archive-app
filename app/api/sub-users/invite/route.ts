import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FROM_EMAIL = process.env.FROM_EMAIL || "Timedshot <noreply@timedshot.com>"

function buildInviteEmailHtml(inviteUrl: string) {
  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="background:linear-gradient(135deg,#6A11CB,#FF7A00);display:inline-block;padding:12px 28px;border-radius:12px;">
      <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Timedshot</span>
    </div>
  </div>
  <h2 style="font-size:24px;font-weight:700;margin-bottom:12px;color:#111;">You've been invited to Timedshot</h2>
  <p style="font-size:15px;color:#555;margin-bottom:28px;">
    A Timedshot account owner has invited you to join their team. Click the button below to accept the invitation and set up your account.
  </p>
  <div style="text-align:center;margin-bottom:32px;">
    <a href="${inviteUrl}"
       style="background:linear-gradient(135deg,#6A11CB,#FF7A00);color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;display:inline-block;">
      Accept Invitation
    </a>
  </div>
  <p style="font-size:13px;color:#888;margin-bottom:8px;">
    If the button doesn't work, copy and paste this link into your browser:
  </p>
  <p style="font-size:12px;word-break:break-all;color:#6A11CB;">
    <a href="${inviteUrl}" style="color:#6A11CB;">${inviteUrl}</a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:28px 0;">
  <p style="font-size:12px;color:#aaa;text-align:center;">
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
</div>`
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)

  if (callerError || !callerData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const callerId = callerData.user.id
  const { parentUserId, email } = await req.json()

  if (!parentUserId || !email) {
    return NextResponse.json({ error: "parentUserId and email are required" }, { status: 400 })
  }

  if (callerId !== parentUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: parentProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, parent_user_id")
    .eq("id", parentUserId)
    .maybeSingle()

  if (!parentProfile) {
    // Profile row is missing (DB trigger didn't fire). Verify the auth user
    // exists, auto-upsert a basic profile, and continue.
    const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(parentUserId)
    if (!authUserData?.user) {
      return NextResponse.json({ error: "Parent user not found" }, { status: 404 })
    }
    const { error: upsertParentError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: parentUserId,
          plan: "basic",
          subscribed: false,
          email: authUserData.user.email,
        },
        { onConflict: "id" }
      )
    if (upsertParentError) {
      console.warn("⚠️ Failed to auto-create parent profile:", upsertParentError.message)
      // Continue anyway — the invite email and sub-user profile creation below
      // do not depend on the parent's profile row being present.
    }
  } else if (parentProfile.parent_user_id) {
    return NextResponse.json({ error: "Sub-users cannot invite other sub-users" }, { status: 403 })
  }

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`

  try {
    // When RESEND_API_KEY is configured use generateLink + Resend so the
    // invite email goes through the same delivery path as signup emails.
    if (process.env.RESEND_API_KEY) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          data: { parent_user_id: parentUserId, needs_password_setup: true },
          redirectTo,
        },
      })

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 400 })
      }

      const inviteUrl = linkData?.properties?.action_link
      if (!inviteUrl) {
        // generateLink returned no URL — fall back to inviteUserByEmail
        console.warn("generateLink returned no action_link for invite, falling back to inviteUserByEmail")
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { parent_user_id: parentUserId, needs_password_setup: true },
          redirectTo,
        })
        if (inviteError) {
          return NextResponse.json({ error: inviteError.message }, { status: 400 })
        }
        if (inviteData?.user?.id) {
          await supabaseAdmin.from("profiles").upsert(
            { id: inviteData.user.id, parent_user_id: parentUserId, email, plan: "basic", subscribed: false },
            { onConflict: "id" }
          )
        }
        return NextResponse.json({ success: true })
      }

      // Send via Resend
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: emailError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "You've been invited to Timedshot",
        html: buildInviteEmailHtml(inviteUrl),
      })

      if (emailError) {
        console.error("Resend invite email failed:", JSON.stringify(emailError))
        return NextResponse.json({ error: "Failed to send invite email. Please try again." }, { status: 500 })
      }

      // Upsert profile for the invited user (generateLink creates the auth user)
      const invitedUserId = linkData?.user?.id
      if (invitedUserId) {
        const { error: upsertError } = await supabaseAdmin
          .from("profiles")
          .upsert(
            { id: invitedUserId, parent_user_id: parentUserId, email, plan: "basic", subscribed: false },
            { onConflict: "id" }
          )
        if (upsertError) {
          console.warn("⚠️ Failed to create profile for invited sub-user:", upsertError.message)
        }
      }

      return NextResponse.json({ success: true })
    }

    // No RESEND_API_KEY — use Supabase's built-in invite email
    const { data: inviteData, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { parent_user_id: parentUserId, needs_password_setup: true },
      redirectTo,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // The DB trigger does NOT fire for invited users — upsert the profile row.
    if (inviteData?.user?.id) {
      const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id: inviteData.user.id,
            parent_user_id: parentUserId,
            email: email,
            plan: "basic",
            subscribed: false,
          },
          { onConflict: "id" }
        )
      if (upsertError) {
        console.warn("⚠️ Failed to create profile for invited sub-user:", upsertError.message)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ Invite error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
