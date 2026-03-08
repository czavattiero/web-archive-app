"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"

export default function LandingPage() {

  const router = useRouter()

  const startCheckout = async (plan: string) => {

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ plan })
    })

    const data = await res.json()

    if (data.url) {
      window.location.href = data.url
    }
  }

  return (

    <main className="min-h-screen bg-white text-center">

      {/* TOP BAR */}

      <div className="flex justify-end p-6">

        <button
          onClick={() => router.push("/login")}
          className="text-purple-700 font-semibold hover:underline"
        >
          Log in
        </button>

      </div>


      {/* LOGO */}

      <div className="flex flex-col items-center mt-10">

        <Image
          src="/screenly-logo.png"
          alt="Screenly"
          width={420}
          height={120}
        />

        <h2 className="text-2xl mt-6 text-gray-700">
          Because you have more important things to do
        </h2>

      </div>


      {/* DESCRIPTION */}

      <div className="max-w-2xl mx-auto mt-8 text-gray-600 text-lg">

        Screenly allows you to automate the capture of URLs and schedule
        future captures. The PDFs can then be downloaded whenever you need.

      </div>


      {/* PRICING */}

      <div className="grid md:grid-cols-2 gap-10 max-w-4xl mx-auto mt-16">


        {/* BASIC PLAN */}

        <div className="border rounded-xl p-8 shadow-sm">

          <h3 className="text-2xl font-semibold text-purple-700">
            Basic
          </h3>

          <p className="text-4xl mt-4 font-bold">
            $15
          </p>

          <p className="text-gray-500 mt-2">
            per month
          </p>

          <ul className="mt-6 text-gray-600 space-y-2">
            <li>50 URLs</li>
            <li>Automated captures</li>
            <li>Download PDFs</li>
          </ul>

          <button
            onClick={() => startCheckout("basic")}
            className="mt-8 bg-purple-700 text-white px-6 py-3 rounded-lg hover:bg-purple-800"
          >
            Choose Basic
          </button>

        </div>


        {/* PROFESSIONAL PLAN */}

        <div className="border rounded-xl p-8 shadow-sm">

          <h3 className="text-2xl font-semibold text-teal-500">
            Professional
          </h3>

          <p className="text-4xl mt-4 font-bold">
            $30
          </p>

          <p className="text-gray-500 mt-2">
            per month
          </p>

          <ul className="mt-6 text-gray-600 space-y-2">
            <li>Unlimited URLs</li>
            <li>Automated captures</li>
            <li>Download PDFs</li>
          </ul>

          <button
            onClick={() => startCheckout("pro")}
            className="mt-8 bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600"
          >
            Choose Professional
          </button>

        </div>

      </div>

    </main>

  )
}
