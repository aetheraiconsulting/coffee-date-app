"use client"

import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { ManageBillingButton } from "@/components/manage-billing-button"

interface Profile {
  subscription_status?: string | null
  trial_ends_at?: string | null
  stripe_customer_id?: string | null
  subscription_ends_at?: string | null
}

export function SubscriptionCard({ profile }: { profile: Profile | null }) {
  const trialDaysLeft = profile?.trial_ends_at
    ? Math.max(0, Math.ceil(
        (new Date(profile.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ))
    : 14

  const statusLabel: Record<string, string> = {
    trial: `Free trial — ${trialDaysLeft} days remaining`,
    active: "Active subscriber",
    limited: "Limited access",
    cancelled: "Cancelled",
    student: "Student access",
  }

  const statusColour: Record<string, string> = {
    trial: "text-amber-400",
    active: "text-green-400",
    limited: "text-red-400",
    cancelled: "text-red-400",
    student: "text-[#00AAFF]",
  }

  const status = profile?.subscription_status || "trial"
  const label = statusLabel[status] || "Free trial"
  const colour = statusColour[status] || "text-amber-400"

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white font-semibold">Subscription</p>
          <span className={`text-sm font-medium ${colour}`}>
            {label}
          </span>
        </div>
        {profile?.subscription_ends_at && profile?.subscription_status === "active" && (
          <p className="text-white/30 text-xs mb-4">
            Next billing date: {new Date(profile.subscription_ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          {profile?.stripe_customer_id ? (
            <ManageBillingButton />
          ) : (
            <Link href="/upgrade" className="text-sm bg-[#00AAFF] text-black font-bold px-4 py-2 rounded-lg">
              Start free trial →
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
