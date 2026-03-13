import { NextResponse } from "next/server"

export async function POST() {

  try {

    const workflowFile = "hourly-playwright-pdf.yml"

    const response = await fetch(
      `https://api.github.com/repos/czavattiero/web-archive-app/actions/workflows/${workflowFile}/dispatches`,
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

    const text = await response.text()

    console.log("GitHub response:", text)

    if (!response.ok) {
      throw new Error(text)
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
