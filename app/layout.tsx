export const dynamic = "force-dynamic"

export const metadata = {
  title: "Screenly",
  description: "Automated screenshots with timestamp",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
