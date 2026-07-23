import { NextResponse } from "next/server"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"
import { alertAdmin } from "../../../lib/server/alertAdmin"

export async function POST(request: Request) {
  let authUser: { id: string; email: string | null; token: string } | null = null
  try {
    authUser = await getAuthenticatedUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const billingDecision = await getBillingAccessDecision(authUser.id)
    if (!billingDecision.allowed) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
    }

    console.log("🚀 /api/capture endpoint called")
    console.log("GITHUB_TOKEN available:", !!process.env.GITHUB_TOKEN)

    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN environment variable not set")
    }

    const res = await fetch(
      "https://api.github.com/repos/czavattiero/web-archive-app/actions/workflows/capture.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            capture_mode: "IMMEDIATE",
          },
        }),
      }
    )

    console.log("GitHub API response status:", res.status)

    if (!res.ok) {
      const errorText = await res.text()
      console.error("GitHub API error:", res.status, errorText)
      await alertAdmin("capture", "Capture workflow dispatch failed", `GitHub API error ${res.status}: ${errorText}`, authUser)
      // Forward GitHub's real status and message instead of masking it as a
      // generic 500 — this is what made a bad/under-scoped GITHUB_TOKEN so
      // hard to diagnose from the UI last time.
      return NextResponse.json(
        {
          success: false,
          error: `GitHub API error (${res.status}): ${errorText || "no additional detail"}`,
          upstreamStatus: res.status,
        },
        { status: res.status >= 400 && res.status < 600 ? res.status : 502 }
      )
    }

    console.log("✅ Workflow dispatch succeeded")
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ /api/capture error:", err.message)
    await alertAdmin("capture", "Unhandled error in /api/capture", err.message, authUser)
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}
