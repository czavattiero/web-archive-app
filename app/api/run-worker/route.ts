import { NextResponse } from "next/server"

export async function POST() {

  try {

    const repoOwner = "czavattiero"
    const repoName = "web-archive-app"
    const workflowFile = "hourly-playwright-pdf.yml"

    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowFile}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ref: "main"
        })
      }
    )

    const text = await response.text()

    console.log("GitHub API response:", text)

    if (!response.ok) {
      throw new Error(text)
    }

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error("Worker trigger failed:", error)

    return NextResponse.json(
      { error: "Failed to trigger GitHub worker" },
      { status: 500 }
    )

  }

}
