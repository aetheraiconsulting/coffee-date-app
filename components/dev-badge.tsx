"use client"

import { useUserState } from "@/context/StateContext"
import { Badge } from "@/components/ui/badge"

export function DevBadge() {
  const { state, loading } = useUserState()

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null
  }

  if (loading || !state) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-1 p-3 bg-black/90 border border-white/20 rounded-lg text-xs font-mono max-w-[200px]">
      <div className="text-white/50 mb-1">DEV STATE</div>
      <Badge variant="outline" className="text-[10px] border-[#00AAFF] text-[#00AAFF]">
        {state.missionState}
      </Badge>
      <div className="text-white/40 mt-2 space-y-0.5">
        <div>GHL: {state.ghlCount}</div>
        <div>Niches: {state.favouritesCount}</div>
        <div>Outreach: {state.outreachCount}</div>
        <div>Replies: {state.repliesCount}</div>
        <div>Calls: {state.callsCount}</div>
        <div>Wins: {state.winsCount}</div>
        <div>Day: {state.dayInSprint}/14</div>
      </div>
    </div>
  )
}
