import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

// Server-side Supabase client (requires SERVICE ROLE KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();

    console.log("Session ID:", sessionId);

    // 1️⃣ Retrieve Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    if (!session) {
      console.error("Stripe session not found");
      return NextResponse.json(
        { error: "Session not found" },
        { status: 400 }
      );
    }

    if (session.payment_status !== "paid") {
      console.error("Payment not completed");
      return NextResponse.json(
        { error: "Payment not verified" },
        { status: 400 }
      );
    }

    const customerEmail = session.customer_details?.email;
    const customerId = session.customer as string;
    const priceId = session.line_items?.data[0]?.price?.id;

    console.log("Email:", customerEmail);
    console.log("Price ID:", priceId);

    if (!customerEmail) {
      console.error("No customer email found");
      return NextResponse.json(
        { error: "Missing customer email" },
        { status: 400 }
      );
    }

    // 2️⃣ Determine plan
    let plan = "basic";
    let maxUrls = 20;

    if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
      plan = "professional";
      maxUrls = 50;
    }

    console.log("Plan:", plan);

    // 3️⃣ Create or get Supabase user
    let userId: string;

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: customerEmail,
        email_confirm: true,
      });

    if (createError) {
      if (createError.code === "email_exists") {
        console.log("User already exists — fetching...");

        const { data: usersData, error: listError } =
          await supabase.auth.admin.listUsers();

        if (listError) {
          console.error("List users error:", listError);
          return NextResponse.json(
            { error: listError.message },
            { status: 400 }
          );
        }

        const existingUser = usersData.users.find(
          (u) => u.email === customerEmail
        );

        if (!existingUser) {
          console.error("Existing user not found");
          return NextResponse.json(
            { error: "User exists but not found" },
            { status: 400 }
          );
        }

        userId = existingUser.id;
      } else {
        console.error("User creation error:", createError);
        return NextResponse.json(
          { error: createError.message },
          { status: 400 }
        );
      }
    } else {
      userId = newUser.user.id;
      console.log("New user created:", userId);
    }

    // 4️⃣ Insert or update profile
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: customerEmail,
        plan,
        max_urls: maxUrls,
        stripe_customer_id: customerId,
      });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    console.log("Profile upsert successful");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("VERIFY SESSION ERROR:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}