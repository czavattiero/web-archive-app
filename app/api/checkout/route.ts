import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16"
})

export async function POST(req: Request) {

  try {

    const { plan, email } = await req.json()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

    let priceId = ""

    if (plan === "basic") {
      priceId = process.env.STRIPE_BASIC_PRICE_ID!
    }

    if (plan === "professional") {
      priceId = process.env.STRIPE_PRO_PRICE_ID!
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`
    })

    return NextResponse.json({
      url: session.url
    })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    )

  }
}
