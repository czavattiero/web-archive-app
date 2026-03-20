import { NextResponse } from "next/server"

export async function POST() {
  try {
    const res = await fetch(
      "https://api.github.com/repos/czavattiero/web-archive-app/actions/workflows/capture.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_WORKFLOW_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          ref: "main",
        }),
      }
    )

    if (!res.ok) {
      throw new Error("Failed to trigger workflow")
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
