import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// 🔥 Supabase admin client (required to update DB)
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

    // ✅ 1. CREATE OR GET STRIPE CUSTOMER
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

    // ✅ 2. CREATE CHECKOUT SESSION WITH CUSTOMER
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId, // 🔥 IMPORTANT
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/dashboard?fromSignup=true",
      cancel_url: "http://localhost:3000/signup",
    })

    // ✅ 3. SAVE CUSTOMER ID TO SUPABASE
console.log("Saving customer ID:", customerId, "for email:", email)

const { data: updateData, error: updateError } = await supabase
  .from("profiles")
  .update({ stripe_customer_id: customerId })
  .eq("email", email)
  .select()

console.log("Supabase update result:", updateData, updateError)

    // ✅ 4. RETURN CHECKOUT URL
    return NextResponse.json({ url: session.url })

  } catch (err: any) {
    console.error("Checkout error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
