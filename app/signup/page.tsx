import dynamic from "next/dynamic";

const SignupClient = dynamic(() => import("./SignupClient"), {
  ssr: false,
});

export default function SignupPage() {
  return <SignupClient />;
}
