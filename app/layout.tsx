import "./globals.css"
import Script from "next/script"

export const dynamic = "force-dynamic"

export const metadata = {
  metadataBase: new URL("https://www.timedshot.ca"),
  alternates: {
    canonical: "/",
  },
  title: "Timedshot: Scheduled Screenshots, Timestamped PDF Proof",
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
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "y9jw6b4jor");`}
        </Script>
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
