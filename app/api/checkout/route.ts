import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export async function POST(req: Request) {

  const formData = await req.formData()
  const plan = formData.get("plan")

  let priceId: string | undefined

  if (plan === "basic") {
    priceId = process.env.STRIPE_BASIC_PRICE_ID
  }

  if (plan === "pro") {
    priceId = process.env.STRIPE_PRO_PRICE_ID
  }

  if (!priceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",

    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],

    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
  })

  return NextResponse.redirect(session.url!, {
    status: 303,
  })
}
