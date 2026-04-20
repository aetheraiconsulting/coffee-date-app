import type React from "react"
import type { Metadata } from "next"
import { Manrope, DM_Sans } from 'next/font/google'
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["800"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "Aether AI Lab - Land Your First AI Client in 14 Days",
  description: "AI client acquisition system for young entrepreneurs. Send outreach, run audits, close clients. Everything in one place.",
  generator: 'v0.app'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${manrope.variable} ${dmSans.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
