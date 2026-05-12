import { NextResponse } from "next/server"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../lib/server/billingAccess"

export async function POST(req: Request) {
  try {
    const authUser = await getAuthenticatedUserFromRequest(req)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const billingDecision = await getBillingAccessDecision(authUser.id)
    if (!billingDecision.allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    console.log("🚀 Triggering GitHub workflow...")

    const url = `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/capture.yml/dispatches`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, // 🔥 IMPORTANT
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        ref: "main",
      }),
    })

    const text = await response.text()

    console.log("GitHub response:", text)

    if (!response.ok) {
      return NextResponse.json(
        { error: text },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ API ERROR:", err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
