"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight, Target } from "lucide-react"

interface MissionData {
  headline: string
  subtext: string
  cta_label: string
  cta_href: string
  time_estimate: string
  urgency_level: string
  state: string
  dayInSprint: number
  pace: string
  sentCount: number
  replyCount: number
  callCount: number
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
        // Fall back to static copy if generation fails
        setMission({
          headline: "Choose your target niche",
          subtext: "Browse 1,300 niches and find your first opportunity.",
          cta_label: "Browse niches",
          cta_href: "/revival/opportunities",
          time_estimate: "~10 minutes",
          urgency_level: "low",
          state: "no_niche",
          dayInSprint: 1,
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

  return (
    <Card className="bg-gradient-to-br from-[#00AAFF]/15 via-[#00AAFF]/5 to-transparent border-2 border-[#00AAFF]/30 rounded-2xl shadow-xl shadow-[#00AAFF]/10 overflow-hidden">
      <CardContent className="p-6 md:p-8">
        <div className="space-y-6">
          {/* Label with pace badge */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00AAFF] animate-pulse" />
            <span className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider">
              Today&apos;s Mission — Day {mission?.dayInSprint || 1} of 14
            </span>
            {mission?.pace === "behind" && (
              <span className="ml-auto text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
                Behind pace
              </span>
            )}
            {mission?.pace === "slightly_behind" && (
              <span className="ml-auto text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                Pick up pace
              </span>
            )}
            {mission?.pace === "on_track" && (
              <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                On track
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
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {mission?.headline}
              </h2>
              <p className="text-white/50 text-sm mb-4 leading-relaxed">
                {mission?.subtext}
              </p>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => router.push(mission?.cta_href || "/revival/opportunities")}
                  className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/40 transition-all duration-200"
                >
                  {mission?.cta_label} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                {mission?.time_estimate && (
                  <span className="text-white/30 text-xs">
                    {mission.time_estimate}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
