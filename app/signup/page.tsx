"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignupContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");

  return (
    <div style={{ padding: "40px" }}>
      <h1>Create your account</h1>

      {plan && (
        <p>
          Selected plan: <strong>{plan}</strong>
        </p>
      )}

      <p>Signup form goes here.</p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
