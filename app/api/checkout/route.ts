import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

export async function POST(req: Request) {
  try {

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
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
    })

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe session creation failed" },
        { status: 500 }
      )
    }

    return NextResponse.redirect(session.url, {
      status: 303,
    })

  } catch (error) {

    console.error("Checkout error:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
