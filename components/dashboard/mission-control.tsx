"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"

// Mission Control directive shape. The API always returns these fields; for
// sprint mode (and growth mode with 0-1 clients) prospecting_action and
// client_check_in come back as empty strings.
interface MissionData {
  headline: string
  subtext: string
  prospecting_action: string
  client_check_in: string
  cta_label: string
  cta_href: string
  time_estimate: string
  urgency_level: string
  state: string
  dayInSprint: number
  daysSinceStart: number
  mode: "sprint" | "growth"
  clientCount: number
  pace: string
  sentCount: number
  replyCount: number
  callCount: number
}

function getGrowthLabel(clientCount: number): string {
  if (clientCount === 0) return "GROWTH MODE — FIRST CLIENT"
  if (clientCount === 1) return "GROWTH MODE — NEXT CLIENT"
  if (clientCount <= 3) return "GROWTH MODE — SCALING"
  return "DELIVERY MODE — MANAGING CLIENTS"
}

export function MissionControl() {
  const router = useRouter()
  const [mission, setMission] = useState<MissionData | null>(null)
  const [missionLoading, setMissionLoading] = useState(true)

  useEffect(() => {
    const fetchMission = async () => {
      try {
        const response = await fetch("/api/mission/generate")
        const data = await response.json()
        setMission(data)
      } catch {
        // Fall back to static copy if generation fails.
        setMission({
          headline: "Choose your target niche",
          subtext: "Browse 1,300 niches and find your first opportunity.",
          prospecting_action: "",
          client_check_in: "",
          cta_label: "Browse niches",
          cta_href: "/revival/opportunities",
          time_estimate: "~10 minutes",
          urgency_level: "low",
          state: "no_niche",
          dayInSprint: 1,
          daysSinceStart: 0,
          mode: "sprint",
          clientCount: 0,
          pace: "on_track",
          sentCount: 0,
          replyCount: 0,
          callCount: 0,
        })
      } finally {
        setMissionLoading(false)
      }
    }
    fetchMission()
  }, [])

  const isSprint = mission?.mode === "sprint"
  const clientCount = mission?.clientCount ?? 0
  const showSplitView = mission?.mode === "growth" && clientCount >= 2 && clientCount <= 3
  const showDeliveryFirst = mission?.mode === "growth" && clientCount >= 4

  return (
    <Card className="bg-gradient-to-br from-[#00AAFF]/15 via-[#00AAFF]/5 to-transparent border-2 border-[#00AAFF]/30 rounded-2xl shadow-xl shadow-[#00AAFF]/10 overflow-hidden">
      <CardContent className="p-6 md:p-8">
        <div className="space-y-6">
          {/* Mode label + pace badge (sprint only shows pace — growth mode
              doesn't use countdown-based pacing) */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00AAFF] animate-pulse" />
            <span className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider">
              {isSprint
                ? `Today's Mission — Sprint Day ${mission?.dayInSprint || 1} of 14`
                : getGrowthLabel(clientCount)}
            </span>
            {isSprint && mission?.pace === "behind" && (
              <span className="ml-auto text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                Behind pace
              </span>
            )}
            {isSprint && mission?.pace === "slightly_behind" && (
              <span className="ml-auto text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                Pick up pace
              </span>
            )}
            {isSprint && mission?.pace === "on_track" && (
              <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                On track
              </span>
            )}
            {!isSprint && clientCount > 0 && (
              <span className="ml-auto text-xs text-[#00AAFF] bg-[#00AAFF]/10 px-2 py-0.5 rounded-full">
                {clientCount} {clientCount === 1 ? "client" : "clients"}
              </span>
            )}
          </div>

          {missionLoading ? (
            <div className="space-y-3">
              <div className="h-8 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 text-balance">
                  {mission?.headline}
                </h2>
                <p className="text-white/50 text-sm leading-relaxed text-pretty">
                  {mission?.subtext}
                </p>
              </div>

              {/* 2-3 clients: split view — prospecting and client check-in
                  given equal weight */}
              {showSplitView && (mission?.prospecting_action || mission?.client_check_in) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2 font-semibold">
                      Prospecting
                    </p>
                    <p className="text-white text-sm leading-relaxed">
                      {mission?.prospecting_action || "Keep sending messages to your active niche."}
                    </p>
                  </div>
                  <div className="border border-white/10 bg-white/[0.02] rounded-lg p-4">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2 font-semibold">
                      Clients
                    </p>
                    <p className="text-white text-sm leading-relaxed">
                      {mission?.client_check_in || "Check in with your active clients this week."}
                    </p>
                  </div>
                </div>
              )}

              {/* 4+ clients: delivery-first — client work is primary, prospecting
                  is dimmed and secondary */}
              {showDeliveryFirst && (mission?.prospecting_action || mission?.client_check_in) && (
                <div className="space-y-3">
                  <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/[0.05] rounded-lg p-4">
                    <p className="text-[#00AAFF] text-xs uppercase tracking-wider mb-2 font-semibold">
                      Client delivery (primary)
                    </p>
                    <p className="text-white text-sm leading-relaxed">
                      {mission?.client_check_in || "Check in with your most recently onboarded client."}
                    </p>
                  </div>
                  <div className="border border-white/5 bg-white/[0.02] rounded-lg p-3">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2 font-semibold">
                      Prospecting (secondary)
                    </p>
                    <p className="text-white/60 text-sm leading-relaxed">
                      {mission?.prospecting_action || "Keep 10-20 prospecting messages flowing weekly."}
                    </p>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={() => router.push(mission?.cta_href || "/revival/opportunities")}
                  className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/40 transition-all duration-200"
                >
                  {mission?.cta_label} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                {mission?.time_estimate && (
                  <span className="text-white/30 text-xs">{mission.time_estimate}</span>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
