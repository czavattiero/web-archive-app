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

  const signature = req.headers.get("stripe-signature")!

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

  if (event.type === "checkout.session.completed") {

    const session: any = event.data.object

    const subscriptionId = session.subscription
    const customerId = session.customer

    await supabase
      .from("subscriptions")
      .insert({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        status: "active"
      })

    console.log("Subscription stored")
  }

  return new Response("ok", { status: 200 })
}
