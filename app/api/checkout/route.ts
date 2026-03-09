import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

// Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

// Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {

    const { plan, email } = await req.json()

    if (!plan || !email) {
      return NextResponse.json(
        { error: "Missing plan or email" },
        { status: 400 }
      )
    }

    // Get the Supabase user
    const { data: userData, error: userError } = await supabase
      .from("auth.users")
      .select("id,email")
      .eq("email", email)
      .single()

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    const userId = userData.id

    // Determine Stripe price
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

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://web-archive-app.vercel.app"

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      customer_email: email,

      metadata: {
        user_id: userId,
        plan: plan
      },

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}`,
    })

    return NextResponse.json({
      url: session.url,
    })

  } catch (error) {

    console.error("Checkout error:", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
