import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    console.log("🚀 /api/capture endpoint called")

    // Get the request body with proper typing
    let body: { immediate?: boolean } = {}
    try {
      body = await request.json()
    } catch (e) {
      // Empty body is OK for immediate capture
      console.log("No body provided, using defaults")
    }

    const immediate = body.immediate === true

    console.log("📤 Triggering GitHub workflow...")
    console.log("Mode:", immediate ? "IMMEDIATE" : "SCHEDULED")
    console.log("GITHUB_TOKEN available:", !!process.env.GITHUB_TOKEN)

    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN not set in environment variables")
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
            immediate: immediate ? "true" : "false",
          },
        }),
      }
    )

    console.log("✅ GitHub API response status:", res.status)

    if (!res.ok) {
      const errorText = await res.text()
      console.error("❌ GitHub API error:", res.status, errorText)
      return NextResponse.json(
        { success: false, error: `GitHub API error: ${res.status} ${errorText}` },
        { status: 500 }
      )
    }

    console.log("✅ Workflow triggered successfully")
    return NextResponse.json({ success: true, message: "Workflow triggered" })
  } catch (err: any) {
    console.error("❌ API ERROR:", err.message)
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}