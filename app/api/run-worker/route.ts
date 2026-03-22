import { NextResponse } from "next/server"

export async function POST() {
  try {
    console.log("🚀 Triggering GitHub Action...")

    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPO}/actions/workflows/capture.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          ref: "main",
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ GitHub API error:", errorText)

      return NextResponse.json(
        { error: "Failed to trigger worker" },
        { status: 500 }
      )
    }

    console.log("✅ Worker triggered")

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("❌ Unexpected error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
