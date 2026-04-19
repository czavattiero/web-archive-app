import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const immediate = body.immediate || false

    console.log("🚀 Triggering GitHub workflow...")
    console.log("Mode:", immediate ? "IMMEDIATE (new URL)" : "SCHEDULED")
    console.log("GITHUB_TOKEN available:", !!process.env.GITHUB_TOKEN)

    const res = await fetch(
      "https://api.github.com/repos/czavattiero/web-archive-app/actions/workflows/capture.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            immediate: immediate ? "true" : "false",
          },
        }),
      }
    )

    console.log("GitHub response status:", res.status)

    if (!res.ok) {
      const errorText = await res.text()
      console.error("❌ Failed to trigger workflow:", res.status, errorText)
      throw new Error(`Failed to trigger workflow: ${res.status} ${errorText}`)
    }

    console.log("✅ Workflow triggered successfully")
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("❌ API ERROR:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}