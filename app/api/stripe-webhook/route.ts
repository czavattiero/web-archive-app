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

  const body = await req.text()

  const signature = req.headers.get("stripe-signature")!

  let event: Stripe.Event

  try {

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

  } catch (err) {

    console.error("Webhook signature verification failed")

    return NextResponse.json({ error: "Webhook error" }, { status: 400 })

  }

  if (event.type === "checkout.session.completed") {

    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.metadata?.user_id

    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: "active"
    })

  }

  return NextResponse.json({ received: true })

}
