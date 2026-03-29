import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// 🔥 Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, plan } = await req.json()

    const priceId =
      plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_BASIC_PRICE_ID

    if (!priceId) {
      throw new Error("Missing price ID")
    }

    // ✅ Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/dashboard?fromSignup=true",
      cancel_url: "http://localhost:3000/signup",
    })

    // 🔥 VERY IMPORTANT — SAVE CUSTOMER ID
    const customerId = session.customer as string

    if (customerId) {
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("email", email)
    }

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error("Checkout error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
