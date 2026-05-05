import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Supabase admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { email, plan, userId: clientUserId } = await req.json()

    const priceId =
      plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_BASIC_PRICE_ID

    if (!priceId) {
      throw new Error("Missing price ID")
    }

    // 🔥 1. GET USER FROM PROFILES — try by userId first (most reliable),
    //    then fall back to email for backward compatibility.
    let profile: { id: string } | null = null

    if (clientUserId) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", clientUserId)
        .maybeSingle()
      profile = data
    }

    if (!profile) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle()
      profile = data
    }

    if (!profile) {
      throw new Error("User profile not found")
    }

    const userId = profile.id

    // 🔥 2. CREATE OR GET STRIPE CUSTOMER
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    })

    let customerId: string

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id
    } else {
      const newCustomer = await stripe.customers.create({
        email,
      })
      customerId = newCustomer.id
    }

    // 🔥 3. CREATE CHECKOUT SESSION
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      customer: customerId,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // user_id in both session metadata (for verify-session / webhook
      // checkout.session.completed) and subscription metadata (for
      // invoice.payment_succeeded / subscription events).
      metadata: {
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
        },
      },

      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/`,
    })
    
    // 🔥 4. SAVE CUSTOMER ID TO PROFILE
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", userId)

    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error("Checkout error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
