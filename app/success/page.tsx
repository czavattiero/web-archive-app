
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Success() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      router.push("/");
      return;
    }

    const setupAccount = async () => {
      const res = await fetch("/api/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!data.email) {
        router.push("/");
        return;
      }

      const tempPassword = Math.random().toString(36).slice(-10);

      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: tempPassword,
      });

      if (error) {
        console.error(error);
        router.push("/login");
        return;
      }

      router.push("/dashboard");
    };

    setupAccount();
  }, [searchParams, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-bold">
        Payment Successful. Setting up your account...
      </h1>
    </main>
  );
}