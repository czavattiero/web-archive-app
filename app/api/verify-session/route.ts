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

    const { sessionId } = await req.json()

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Missing sessionId" },
        { status: 400 }
      )
    }

    // Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    })

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      )
    }

    const email = session.customer_details?.email

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Customer email not found" },
        { status: 400 }
      )
    }

    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id

    const customerId =
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id

    // Store or update subscription
    const { error } = await supabase
      .from("subscriptions")
      .upsert({
        email,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active",
      })

    if (error) {
      console.error("Supabase error:", error)

      return NextResponse.json(
        { success: false, error: "Database error" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      email,
    })

  } catch (err) {

    console.error("Verify session error:", err)

    return NextResponse.json({
  success: true,
  email
})
