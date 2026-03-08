"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"

export default function Home() {

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

    <main className="min-h-screen bg-white flex flex-col items-center">

      {/* TOP RIGHT LOGIN */}

      <div className="w-full flex justify-end p-6">
        <button
          onClick={() => router.push("/login")}
          className="text-purple-700 font-semibold hover:underline"
        >
          Log in
        </button>
      </div>


      {/* LOGO */}

      <Image
        src="/screenly-logo.png"
        alt="Screenly"
        width={420}
        height={120}
      />

      {/* TAGLINE */}

      <h2 className="text-2xl mt-6 text-gray-700">
        Because you have more important things to do
      </h2>


      {/* DESCRIPTION */}

      <p className="max-w-2xl text-center text-gray-600 mt-6">

        Screenly allows you to automate the captures of URLs and schedule
        future captures. The PDFs can then be downloaded.

      </p>


      {/* PRICING */}

      <div className="grid md:grid-cols-2 gap-10 mt-16 max-w-4xl">


        {/* BASIC */}

        <div className="border rounded-xl p-8 shadow-sm text-center">

          <h3 className="text-2xl font-semibold text-purple-700">
            Basic
          </h3>

          <p className="text-4xl font-bold mt-4">
            $15
          </p>

          <p className="text-gray-500">
            per month
          </p>

          <button
            onClick={() => startCheckout("basic")}
            className="mt-8 bg-purple-700 text-white px-6 py-3 rounded-lg"
          >
            Choose Basic
          </button>

        </div>


        {/* PRO */}

        <div className="border rounded-xl p-8 shadow-sm text-center">

          <h3 className="text-2xl font-semibold text-teal-500">
            Professional
          </h3>

          <p className="text-4xl font-bold mt-4">
            $30
          </p>

          <p className="text-gray-500">
            per month
          </p>

          <button
            onClick={() => startCheckout("pro")}
            className="mt-8 bg-teal-500 text-white px-6 py-3 rounded-lg"
          >
            Choose Professional
          </button>

        </div>

      </div>

    </main>
  )
}
