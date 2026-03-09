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

    const { session_id } = await req.json()

    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (!session || session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      )
    }

    const userId = session.metadata?.user_id

    if (!userId) {
      return NextResponse.json(
        { error: "User ID missing from metadata" },
        { status: 400 }
      )
    }

    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: "active"
    })

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error(error)

    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    )

  }
}
