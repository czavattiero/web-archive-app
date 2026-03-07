import dynamic from "next/dynamic"

export const dynamic = "force-dynamic"

const SignupClient = dynamic(
  () => import("./SignupClient"),
  { ssr: false }
)

export default function Page() {
  return <SignupClient />
}
