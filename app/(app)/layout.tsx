import type React from "react"
import { Toaster } from "@/components/ui/toaster"
import { StateProvider } from "@/context/StateContext"
import { DevBadge } from "@/components/dev-badge"
import { getUserState } from "@/lib/getUserState"
import { AppShellClient } from "@/components/app-shell-client"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch state server-side for initial hydration
  const initialState = await getUserState()

  return (
    <StateProvider initialState={initialState}>
      <AppShellClient>{children}</AppShellClient>
      <Toaster />
      <DevBadge />
    </StateProvider>
  )
}
