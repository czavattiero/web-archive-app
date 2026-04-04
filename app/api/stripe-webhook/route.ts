import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

// 🔥 Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

// 🔥 Supabase admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature")!

  const body = await req.text()

  let event: Stripe.Event

  // ===============================
  // 🔐 VERIFY SIGNATURE
  // ===============================
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
    // =====================================================
    // 🟢 CHECKOUT COMPLETED (FIRST TOUCHPOINT)
    // =====================================================
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session

      const customerId = session.customer as string
      const subscriptionId = session.subscription as string
      let userId = session.metadata?.user_id

      console.log("🔥 CHECKOUT SESSION:", {
        customerId,
        subscriptionId,
        metadata: session.metadata,
      })

      // 🔥 Fallback: find user by customer
      if (!userId && customerId) {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle()

        userId = data?.id
      }

      if (!userId) {
        console.error("❌ No user found in checkout event")
        return NextResponse.json({ received: true })
      }

      // ✅ Ensure profile is updated
      await supabase
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          subscribed: true,
        })
        .eq("id", userId)

      // ✅ Insert subscription
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
    }

    // =====================================================
    // 💰 INVOICE PAYMENT SUCCEEDED (MOST RELIABLE)
    // =====================================================
    // ===============================
// 💰 INVOICE PAYMENT SUCCEEDED
// ===============================
if (event.type === "invoice.payment_succeeded") {
  const invoice = event.data.object as Stripe.Invoice

  const customerId = invoice.customer as string

  // 🔥 GET CUSTOMER FROM STRIPE
  const customer = await stripe.customers.retrieve(customerId)

  let email: string | null = null

  if (!("deleted" in customer)) {
    email = customer.email
  }

  console.log("🔥 INVOICE EVENT:", {
    customerId,
    email,
  })

  let userId: string | null = null

  // ✅ TRY MATCH BY CUSTOMER ID
  const { data: profileByCustomer } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle()

  if (profileByCustomer) {
    userId = profileByCustomer.id
  }

  // 🔥 FALLBACK: MATCH BY EMAIL
  if (!userId && email) {
    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    userId = profileByEmail?.id
  }

  if (!userId) {
    console.error("❌ No user found (customer + email failed)")
    return NextResponse.json({ received: true })
  }

  console.log("✅ USER FOUND:", userId)

  const subscriptionId = invoice.subscription as string

  // ✅ INSERT / UPDATE SUBSCRIPTION
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

  // ✅ UPDATE PROFILE
  await supabase
    .from("profiles")
    .update({
      subscribed: true,
      stripe_customer_id: customerId,
    })
    .eq("id", userId)
}
    
    // =====================================================
    // 🔄 SUBSCRIPTION UPDATED
    // =====================================================
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription

      await supabase
        .from("subscriptions")
        .update({
          status: subscription.status,
        })
        .eq("stripe_subscription_id", subscription.id)
    }

    // =====================================================
    // ❌ SUBSCRIPTION CANCELLED
    // =====================================================
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription

      const customerId = subscription.customer as string

      // ✅ Mark subscription canceled
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
        })
        .eq("stripe_subscription_id", subscription.id)

      // ✅ Update profile
      await supabase
        .from("profiles")
        .update({
          subscribed: false,
        })
        .eq("stripe_customer_id", customerId)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("❌ Webhook handler error:", err)
    return new Response("Webhook handler failed", { status: 500 })
  }
}
