import Stripe from "stripe";

export async function POST() {

  try {

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      line_items: [
        {
          price: process.env.STRIPE_BASIC_PRICE_ID!,
          quantity: 1,
        },
      ],

      success_url: "https://web-archive-app.vercel.app/dashboard",
      cancel_url: "https://web-archive-app.vercel.app/signup",
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200 }
    );

  } catch (error: any) {

    console.error("Stripe error:", error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
