import { NextResponse } from "next/server"
import { exec } from "child_process"

export async function POST() {

  exec("node worker/screenshotWorker.js")

  return NextResponse.json({ status: "worker started" })
}
