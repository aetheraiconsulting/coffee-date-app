import type React from "react"
import type { Metadata } from "next"
import { Syne, DM_Sans } from 'next/font/google'
import "./globals.css"

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["700", "800"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500"],
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
      <body className={`${syne.variable} ${dmSans.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
