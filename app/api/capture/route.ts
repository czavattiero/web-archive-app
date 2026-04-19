import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
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
      throw new Error(`GitHub API error: ${res.status} ${errorText}`)
    }

    console.log("✅ Workflow dispatch succeeded")
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ /api/capture error:", err.message)
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
}