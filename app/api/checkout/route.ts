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
    const { email, plan } = await req.json()

    const priceId =
      plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_BASIC_PRICE_ID

    if (!priceId) {
      throw new Error("Missing price ID")
    }

    // 🔥 1. GET USER FROM PROFILES (CRITICAL)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single()

    if (profileError || !profile) {
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

    // 🔥 3. CREATE CHECKOUT SESSION (FIXED)
    const session = await stripe.checkout.sessions.create({
  mode: "subscription",

  customer: customerId,

  line_items: [
    {
      price: priceId,
      quantity: 1,
    },
  ],

  // 🔥 THE REAL FIX
  subscription_data: {
    metadata: {
      user_id: userId,
    },
  },

  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
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
