import { NextResponse } from "next/server"

export async function POST() {

  try {

    const response = await fetch(
      "https://api.github.com/repos/czavattiero/web-archive-app/actions/workflows/hourly-playwright-pdf-capture.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({
          ref: "main"
        })
      }
    )

    if (!response.ok) {

      const text = await response.text()
      console.error("GitHub trigger error:", text)

      throw new Error("Failed to trigger workflow")

    }

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error("Worker trigger failed:", error)

    return NextResponse.json(
      { error: "Worker trigger failed" },
      { status: 500 }
    )

  }
}
