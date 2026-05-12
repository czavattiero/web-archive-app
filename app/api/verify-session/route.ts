import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient, PostgrestError } from "@supabase/supabase-js"

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

    let paymentConfirmed = session.payment_status === "paid"

    if (!paymentConfirmed) {
      let subscriptionActive = false
      if (session.subscription) {
        try {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          subscriptionActive = sub.status === "active" || sub.status === "trialing"
        } catch (subErr) {
          console.warn("Could not retrieve subscription for payment_status fallback:", subErr)
        }
      }
      if (!subscriptionActive) {
        console.log("Payment not completed and subscription not active:", session.payment_status)
        return NextResponse.json({ success: false })
      }
      console.log("payment_status not 'paid' yet but subscription is active — proceeding")
      paymentConfirmed = true
    }

    let userId = session.metadata?.user_id

    console.log("USER ID:", userId)

    if (!userId && session.customer) {
      const customerId = session.customer as string
      try {
        const { data: profileByCustomer } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle()
        if (profileByCustomer?.id) {
          userId = profileByCustomer.id
          console.log("Resolved userId via stripe_customer_id fallback:", userId)
        }
      } catch (lookupErr) {
        console.warn("stripe_customer_id profile lookup failed:", lookupErr)
      }
    }

    if (!userId) {
      console.log("User ID missing from metadata and could not be resolved via customer ID")
      return NextResponse.json({ success: false })
    }

    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        status: "active"
      })

    if (subscriptionError) {
      // Log but do not treat as a hard failure — profiles.subscribed is the
      // authoritative field checked by all downstream guards.
      console.warn("Subscriptions upsert error (non-fatal):", subscriptionError)
    }

    const customerId = session.customer as string
    const subscriptionId = session.subscription as string
    const PLAN_BASIC = "basic"
    const PLAN_PRO = "pro"

    let plan = PLAN_BASIC
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 1 })
      if (lineItems.data.length > 0) {
        const firstLineItem = lineItems.data[0]
        const priceId = firstLineItem.price?.id

        if (!priceId) {
          console.warn("Missing price ID in session line item:", sessionId)
        } else if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
          plan = PLAN_PRO
        } else {
          console.warn("Unknown price ID in session line item:", priceId)
        }
      } else {
        console.warn("No line items found for session:", sessionId)
      }
    } catch (lineItemsError) {
      console.warn("Could not determine plan from line items:", lineItemsError)
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("subscription_started_at")
      .eq("id", userId)
      .maybeSingle()

    const profileUpsertData: Record<string, unknown> = {
      id: userId,
      subscribed: true,
      trial_ends_at: null,
      stripe_customer_id: customerId,
      plan,
    }
    if (!existingProfile?.subscription_started_at) {
      profileUpsertData.subscription_started_at = new Date().toISOString()
    }

    // Retry the profile upsert up to 3 times with a 500ms delay between attempts
    let profileError: PostgrestError | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      const { error } = await supabase
        .from("profiles")
        .upsert(profileUpsertData, { onConflict: "id" })
      profileError = error
      if (!profileError) break
      console.warn(`Profile upsert attempt ${attempt + 1} failed:`, error)
    }

    // If all upsert attempts failed, try a plain update as fallback
    // (the profile row should already exist for every authenticated user)
    if (profileError) {
      const { id: excludedId, ...updateData } = profileUpsertData
      void excludedId
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
      if (!updateError) {
        profileError = null
      } else {
        console.error("Profile update fallback also failed:", updateError)
      }
    }

    if (profileError) {
      const { error: minimalUpdateError } = await supabase
        .from("profiles")
        .update({ subscribed: true, trial_ends_at: null, plan })
        .eq("id", userId)
      if (!minimalUpdateError) {
        console.log(`Full profile upsert failed but minimal update (subscribed + plan) succeeded for user ${userId}`)
        profileError = null
      } else {
        console.error("Minimal profile update also failed:", minimalUpdateError)
      }
    }

    if (profileError) {
      console.error("Failed to upsert profile with subscription data:", profileError)
      // Payment IS confirmed by Stripe — returning false here causes an infinite
      // retry loop on the dashboard. Return success so the UI moves forward;
      // the stripe-webhook will handle the profile update asynchronously.
      return NextResponse.json({ success: paymentConfirmed, profileUpdateFailed: true })
    }

    console.log("Subscription stored successfully")

    return NextResponse.json({ success: true })

  } catch (error) {

    console.error("Verification error:", error)

    return NextResponse.json({ success: false })

  }

}
