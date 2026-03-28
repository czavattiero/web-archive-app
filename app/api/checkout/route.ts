import { NextResponse } from "next/server"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {

  const { email, plan } = await req.json()

  const priceId =
    plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_BASIC_PRICE_ID

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [
      {
        price: priceId!,
        quantity: 1,
      },
    ],

    // ✅ THIS IS THE LINE YOU NEED TO CHANGE
    success_url: "http://localhost:3000/dashboard?fromSignup=true",

    cancel_url: "http://localhost:3000/signup",
  })

  return NextResponse.json({ url: session.url })
}
