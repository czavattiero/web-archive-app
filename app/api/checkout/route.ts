import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16"
})

export async function POST(req: Request) {

  try {

    const { plan, email, userId } = await req.json()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

    let priceId = ""

    if (plan === "basic") {
      priceId = process.env.STRIPE_BASIC_PRICE_ID!
    }

    if (plan === "pro") {
      priceId = process.env.STRIPE_PRO_PRICE_ID!
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      customer_email: email,

      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],

      metadata: {
        user_id: userId
      },

      success_url: `${siteUrl}/login`,
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
