import "./globals.css"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Timedshot",
  description: "Automated screenshots with timestamp",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Timedshot",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "Automated, timestamped screenshot scheduling tool that delivers timestamped PDF proof of webpage content, commonly used by employers hiring foreign workers in Canada to document job postings for LMIA (Labour Market Impact Assessment) and Temporary Foreign Worker Program (TFWP) recruitment requirements.",
              "offers": {
                "@type": "Offer",
                "price": "12",
                "priceCurrency": "CAD",
              },
            }),
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
