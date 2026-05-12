import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "./lib/server/billingAccess"

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const fromPayment = req.nextUrl.searchParams.get("fromPayment") === "true"
    const sessionId = req.nextUrl.searchParams.get("session_id")
    if (fromPayment && sessionId) {
      return NextResponse.next()
    }

    const authUser = await getAuthenticatedUserFromRequest(req)
    if (!authUser) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const billingDecision = await getBillingAccessDecision(authUser.id)
    if (!billingDecision.allowed) {
      return NextResponse.redirect(new URL("/choose-plan", req.url))
    }
  }

  return NextResponse.next()

}

export const config = {
  matcher: ["/dashboard/:path*"]
}
