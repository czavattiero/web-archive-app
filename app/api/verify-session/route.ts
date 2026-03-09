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
    const sessionId = body.session_id

    console.log("SESSION ID:", sessionId)

    if (!sessionId) {
      console.log("Missing session id")
      return NextResponse.json({ success: false })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    console.log("STRIPE SESSION:", session)

    if (!session) {
      console.log("Stripe session not found")
      return NextResponse.json({ success: false })
    }

    if (session.payment_status !== "paid") {
      console.log("Payment not completed:", session.payment_status)
      return NextResponse.json({ success: false })
    }

    const userId = session.metadata?.user_id

    console.log("USER ID:", userId)

    if (!userId) {
      console.log("User ID missing from metadata")
      return NextResponse.json({ success: false })
    }

    const { error } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        status: "active"
      })

    if (error) {
      console.log("Supabase error:", error)
      return NextResponse.json({ success: false })
    }

    console.log("Subscription stored successfully")

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error("Verification error:", error)

    return NextResponse.json({ success: false })

  }

}
