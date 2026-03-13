import { NextResponse } from "next/server"

export async function POST() {

  try {

    const response = await fetch(
      "https://api.github.com/repos/YOUR_GITHUB_USERNAME/YOUR_REPO/actions/workflows/hourly-playwright-pdf-capture.yml/dispatches",
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
      throw new Error("Failed to trigger worker")
    }

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      { error: "Worker trigger failed" },
      { status: 500 }
    )

  }
}
