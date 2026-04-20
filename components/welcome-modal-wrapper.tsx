"use client"

import { useState } from "react"
import { WelcomeModal } from "@/components/welcome-modal"

type Props = {
  userId: string
  hasCompletedOnboarding: boolean
}

export function WelcomeModalWrapper({ userId, hasCompletedOnboarding }: Props) {
  const [open, setOpen] = useState(!hasCompletedOnboarding)

  if (hasCompletedOnboarding) return null

  return <WelcomeModal open={open} userId={userId} onComplete={() => setOpen(false)} />
}
