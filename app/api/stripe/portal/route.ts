import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedUserFromRequest, getBillingAccessDecision } from "../../../../lib/server/billingAccess"
import { alertAdmin } from "../../../../lib/server/alertAdmin"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const authUser = await getAuthenticatedUserFromRequest(req)
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { userId } = await req.json()
  if (authUser.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const billingDecision = await getBillingAccessDecision(authUser.id)
  if (!billingDecision.userProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  if (billingDecision.userProfile.parent_user_id) {
    return NextResponse.json({ error: "Sub-users cannot manage billing" }, { status: 403 })
  }

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
    } catch (error: any) {
      fallbackLookupFailed = true
      console.error("Stripe customer fallback lookup failed:", error)
      await alertAdmin("stripe-portal", "Stripe customer fallback lookup failed", error?.message || String(error), authUser)
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

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error("Failed to create Stripe billing portal session:", err)
    await alertAdmin("stripe-portal", "Failed to create Stripe billing portal session", err?.message || String(err), authUser)
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 })
  }
}
