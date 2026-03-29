import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 🔥 IMPORTANT
)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("❌ Webhook signature failed:", err)
    return new NextResponse("Webhook Error", { status: 400 })
  }

  // 🎯 HANDLE CHECKOUT SUCCESS
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const email = session.customer_email

    console.log("✅ Payment success for:", email)

    // 🔥 FIND USER BY EMAIL
    const { data: users } = await supabase.auth.admin.listUsers()

    const user = users.users.find(u => u.email === email)

    if (!user) {
      console.log("❌ No user found for email:", email)
      return NextResponse.json({ received: true })
    }

    console.log("✅ Found user:", user.id)

    // 🔥 SAVE SUBSCRIPTION WITH user_id
    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
    })

    if (error) {
      console.error("❌ Insert error:", error)
    } else {
      console.log("🔥 Subscription saved with user_id")
    }
  }

  return NextResponse.json({ received: true })
}
