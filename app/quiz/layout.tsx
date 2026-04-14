import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Readiness Quiz",
  description: "Discover your AI readiness score in under 3 minutes",
}

export default function QuizPublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: "#080B0F",
        overflowY: "auto",
      }}
    >
      {children}
    </div>
  )
}
