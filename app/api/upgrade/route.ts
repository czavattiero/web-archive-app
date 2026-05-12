import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUserFromRequest } from "../../../lib/server/billingAccess"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId, priceId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  if (authUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resolvedPriceId = priceId || process.env.STRIPE_PRO_PRICE_ID

  if (!resolvedPriceId) {
    return NextResponse.json({ error: "No price ID configured" }, { status: 500 })
  }

  try {
    // Look up the user's existing Stripe customer ID and email from their profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle()

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: { user_id: userId },
      subscription_data: { metadata: { user_id: userId } },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    }

    if (profile?.stripe_customer_id) {
      // Reuse the existing Stripe customer to avoid duplicate customers
      sessionParams.customer = profile.stripe_customer_id
    } else if (profile?.email) {
      // Pre-fill the email so Stripe can match an existing customer
      sessionParams.customer_email = profile.email
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("❌ Upgrade checkout error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
