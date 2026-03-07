import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
})

export async function POST() {

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",

    line_items: [
      {
        price: process.env.STRIPE_BASIC_PRICE_ID!,
        quantity: 1,
      },
    ],

    success_url: "https://web-archive-app.vercel.app/dashboard",
    cancel_url: "https://web-archive-app.vercel.app/signup",
  })

  return Response.json({ url: session.url })
}
