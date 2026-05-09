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
  let multipleCustomersFound = false
  let customerEmailMismatch = false

  if (!customerId && profile?.email) {
    try {
      const normalizedProfileEmail = profile.email.trim().toLowerCase()
      const existingCustomers = await stripe.customers.list({
        email: normalizedProfileEmail,
        limit: 2,
      })

      if (existingCustomers.data.length > 1) {
        multipleCustomersFound = true
      } else if (existingCustomers.data.length === 1) {
        const matchedCustomer = existingCustomers.data[0]
        if (
          matchedCustomer.email?.trim().toLowerCase() === normalizedProfileEmail
        ) {
          customerId = matchedCustomer.id
        } else {
          customerEmailMismatch = true
        }

        if (customerId) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("id", userId)

          if (updateError) {
            console.error("Failed to persist stripe_customer_id:", updateError)
          }
        }
      }
    } catch (error) {
      fallbackLookupFailed = true
      console.error("Stripe customer fallback lookup failed:", error)
    }
  }

  if (!customerId) {
    if (multipleCustomersFound || customerEmailMismatch) {
      return NextResponse.json(
        {
          error:
            "Unable to determine your billing account automatically. Please contact support.",
        },
        { status: 409 }
      )
    }

    if (fallbackLookupFailed) {
      return NextResponse.json(
        {
          error:
            "Unable to retrieve billing information. Please try again or contact support.",
        },
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
