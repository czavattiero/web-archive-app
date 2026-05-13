import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "./lib/server/billingAccess"

// Maximum number of times the middleware will redirect to /account-setup when a
// profile row is not yet visible (e.g. replication lag). After this many
// attempts the user is sent to an error page instead of looping forever.
const MAX_PROFILE_SETUP_RETRIES = 5

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
        const attempt = parseInt(req.nextUrl.searchParams.get("_pf_attempt") ?? "0", 10)
        if (attempt >= MAX_PROFILE_SETUP_RETRIES) {
          return NextResponse.redirect(new URL("/account-setup?error=profile_propagation_failed", req.url))
        }
        const retryUrl = new URL("/account-setup", req.url)
        retryUrl.searchParams.set("_pf_attempt", String(attempt + 1))
        return NextResponse.redirect(retryUrl)
      }
      return NextResponse.redirect(new URL("/choose-plan", req.url))
    }
  }

  return NextResponse.next()

}

export const config = {
  matcher: ["/dashboard/:path*"]
}
