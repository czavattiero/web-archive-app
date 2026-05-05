import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export async function POST(req: Request) {
  const { userId, priceId } = await req.json()

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  const resolvedPriceId = priceId || process.env.STRIPE_PRO_PRICE_ID

  if (!resolvedPriceId) {
    return NextResponse.json({ error: "No price ID configured" }, { status: 500 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: { user_id: userId },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("❌ Upgrade checkout error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}