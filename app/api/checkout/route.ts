import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16"
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  try {

    const body = await req.json()

    const plan = body.plan
    const email = body.email

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!

    let priceId = ""

    if (plan === "basic") {
      priceId = process.env.STRIPE_BASIC_PRICE_ID!
    }

    if (plan === "pro" || plan === "professional") {
      priceId = process.env.STRIPE_PRO_PRICE_ID!
    }

    if (!priceId) {
      throw new Error("Invalid plan")
    }

    // Find the Supabase user using email
    const { data } = await supabase.auth.admin.listUsers()

    const user = data.users.find((u) => u.email === email)

    if (!user) {
      throw new Error("User not found")
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
        user_id: user.id
      },

      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`
    })

    return NextResponse.json({
      url: session.url
    })

  } catch (error) {

    console.error("Stripe checkout error:", error)

    return NextResponse.json(
      { error: "Stripe checkout failed" },
      { status: 500 }
    )

  }

}
