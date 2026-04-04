import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!

  const body = await req.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error("❌ Webhook signature error:", err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    // ===============================
    // ✅ CHECKOUT COMPLETED
    // ===============================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      let userId = session.metadata?.user_id

      // 🔥 FALLBACK (VERY IMPORTANT)
      if (!userId && customerId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single()

        userId = profile?.id
      }

      if (!userId) {
        console.error("❌ No user found (metadata + fallback failed)")
        return NextResponse.json({ received: true })
      }

      console.log("✅ Linking subscription to user:", userId)

      // ✅ Insert subscription (avoid duplicates)
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          status: "active",
        },
        {
          onConflict: "stripe_subscription_id",
        }
      )

      // ✅ Update profile
      await supabase
        .from("profiles")
        .update({
          subscribed: true,
          stripe_customer_id: customerId,
        })
        .eq("id", userId)
    }

    // ===============================
    // 🔄 SUBSCRIPTION UPDATED
    // ===============================
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription

      await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
        })
        .eq("stripe_subscription_id", subscription.id)
    }

    // ===============================
    // ❌ SUBSCRIPTION CANCELLED
    // ===============================
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription

      // Update subscription
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
        })
        .eq("stripe_subscription_id", subscription.id)

      // Update profile
      await supabase
        .from("profiles")
        .update({
          subscribed: false,
        })
        .eq("stripe_customer_id", subscription.customer as string)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("❌ Webhook handler error:", err)
    return new Response("Webhook handler failed", { status: 500 })
  }
}
