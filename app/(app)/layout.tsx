import type React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Toaster } from "@/components/ui/toaster"
import { StateProvider } from "@/context/StateContext"
import { DevBadge } from "@/components/dev-badge"
import { getUserState } from "@/lib/getUserState"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch state server-side for initial hydration
  const initialState = await getUserState()

  return (
    <StateProvider initialState={initialState}>
      <div className="flex h-screen bg-black">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative z-10">
          <AppHeader />
          <main className="flex-1 overflow-auto bg-black">{children}</main>
        </div>
        <Toaster />
        <DevBadge />
      </div>
    </StateProvider>
  )
}
