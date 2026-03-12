import { NextResponse } from "next/server"

export async function POST() {

  await fetch(
    "https://api.github.com/repos/czavattiero/web-archive-app/actions/workflows/hourly-playwright-pdf.yml/dispatches",
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

  return NextResponse.json({ success: true })
}
