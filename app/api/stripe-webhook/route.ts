import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16"
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  return new Response("Stripe webhook endpoint is live.", { status: 200 })
}

export async function POST(req: Request) {

  const body = await req.text()

  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 })
  }

  let event: Stripe.Event

  try {

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

  } catch (err) {

    console.error("Webhook signature verification failed:", err)

    return new Response("Webhook Error", { status: 400 })
  }

  try {

    if (event.type === "checkout.session.completed") {

      const session = event.data.object as Stripe.Checkout.Session

      const email = session.customer_details?.email

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id

      if (!email || !subscriptionId || !customerId) {
        console.error("Missing required Stripe data")
        return new Response("Missing data", { status: 400 })
      }

      const { error } = await supabase
        .from("subscriptions")
        .upsert({
          email: email,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "active"
        })

      if (error) {
        console.error("Supabase error:", error)
        return new Response("Database error", { status: 500 })
      }

      console.log("Subscription stored successfully")
    }

    return new Response("ok", { status: 200 })

  } catch (err) {

    console.error("Webhook processing error:", err)

    return new Response("Server error", { status: 500 })
  }
}
