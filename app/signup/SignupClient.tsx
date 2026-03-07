"use client";

import { useSearchParams } from "next/navigation";

export default function SignupClient() {
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
