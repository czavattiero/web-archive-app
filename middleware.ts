import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "./lib/server/billingAccess"

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const authUser = await getAuthenticatedUserFromRequest(req)
    if (!authUser) {
      return NextResponse.redirect(new URL("/login", req.url))
    }

    const fromPayment = req.nextUrl.searchParams.get("fromPayment") === "true"
    const billingDecision = await getBillingAccessDecision(authUser.id)
    if (!billingDecision.allowed && !fromPayment) {
      if (billingDecision.reason === "profile_not_found") {
        return NextResponse.redirect(new URL("/signup?confirmed=true&plan=trial", req.url))
      }
      return NextResponse.redirect(new URL("/choose-plan", req.url))
    }
  }

  return NextResponse.next()

}

export const config = {
  matcher: ["/dashboard/:path*"]
}
