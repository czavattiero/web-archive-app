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
  const { userId } = await req.json()

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", userId)
    .single()

  let customerId = profile?.stripe_customer_id
  let fallbackLookupFailed = false

  if (!customerId && profile?.email) {
    try {
      const existingCustomers = await stripe.customers.list({
        email: profile.email,
        limit: 1,
      })

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId)

        if (updateError) {
          console.error("Failed to persist stripe_customer_id:", updateError)
        }
      }
    } catch (error) {
      fallbackLookupFailed = true
      console.error("Stripe customer fallback lookup failed:", error)
    }
  }

  if (!customerId) {
    if (fallbackLookupFailed) {
      return NextResponse.json(
        { error: "Failed to lookup Stripe customer" },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: "No Stripe customer" }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
