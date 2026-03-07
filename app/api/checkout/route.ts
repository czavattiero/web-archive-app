import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20"
});

export async function POST(req: Request) {

  const { plan } = await req.json();

  const priceId =
    plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_BASIC_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],

    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],

    success_url: "http://localhost:3000/dashboard",
    cancel_url: "http://localhost:3000/"
  });

  return NextResponse.json({
    url: session.url
  });
}
