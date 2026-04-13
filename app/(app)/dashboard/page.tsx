import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  Send,
  Phone,
  Handshake,
  MessageSquare,
  Compass,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"
import { getUserState } from "@/lib/getUserState"
import { MissionControl } from "@/components/dashboard/mission-control"

export default async function DashboardPage() {
  const state = await getUserState()

  if (!state) {
    redirect("/login")
  }

  // Destructure state for easier access
  const {
    ghlCount,
    favouritesCount,
    outreachCount,
    repliesCount,
    callsCount,
    winsCount,
    conversationsCount,
    activeConversationsCount,
    missionState,
    dayInSprint,
    fullName,
    email,
  } = state

  // Get first name
  const firstName = fullName?.split(" ")[0] || email?.split("@")[0] || "there"

  

  // Path to first client - 6 steps
  const pathSteps = [
    { 
      label: "Choose your target niche", 
      href: "/revival/opportunities",
      completed: missionState !== "no_niche"
    },
    { 
      label: "Build your offer", 
      href: "/offer/builder?mode=new",
      completed: !["no_niche", "no_offer"].includes(missionState)
    },
    { 
      label: "Generate outreach messages", 
      href: "/outreach",
      completed: !["no_niche", "no_offer", "no_outreach"].includes(missionState)
    },
    { 
      label: "Get your first reply", 
      href: "/outreach",
      completed: ["replies_received", "call_booked", "call_completed", "proposal_sent"].includes(missionState)
    },
    { 
      label: "Book a demo call", 
      href: "/outreach",
      completed: ["call_booked", "call_completed", "proposal_sent"].includes(missionState)
    },
    { 
      label: "Send your first proposal", 
      href: "/proposal/builder",
      completed: missionState === "proposal_sent"
    },
  ]

  // Calculate progress
  const completedSteps = pathSteps.filter(s => s.completed).length
  const progressPercent = Math.round((completedSteps / pathSteps.length) * 100)

  // Find current step (first incomplete)
  const currentStepIndex = pathSteps.findIndex(s => !s.completed)

  // Pipeline metrics (4 cards only as per spec)
  const pipelineStats = [
    { label: "Leads Contacted", value: outreachCount, icon: Send },
    { label: "Replies", value: repliesCount, icon: MessageSquare },
    { label: "Calls Booked", value: callsCount, icon: Phone },
    { label: "Deals Closed", value: winsCount, icon: Handshake },
  ]

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        {/* ============================================
            1. TODAY'S MISSION (PRIMARY FOCUS)
        ============================================ */}
        <section>
          <MissionControl />
        </section>

        {/* ============================================
            2. PROGRESS TRACKER (step-based + day count)
        ============================================ */}
        <section className="space-y-3">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>Day {dayInSprint} of 14 — First Client Sprint</span>
            <span>{progressPercent}% complete</span>
          </div>
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#00AAFF] rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>

        {/* ============================================
            3. YOUR PATH TO FIRST CLIENT (6 step checklist)
        ============================================ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
            Your Path to First Client
          </h2>
          <Card className="bg-white/[0.03] border border-white/10 rounded-xl">
            <CardContent className="p-0">
              {pathSteps.map((step, index) => {
                const isCurrent = index === currentStepIndex
                return (
                  <Link
                    key={index}
                    href={step.href}
                    className={cn(
                      "flex items-center gap-4 p-4 transition-all hover:bg-white/[0.03]",
                      index !== pathSteps.length - 1 && "border-b border-white/10"
                    )}
                  >
                    {/* Status dot */}
                    <div className="shrink-0">
                      {step.completed ? (
                        <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full bg-[#00AAFF] animate-pulse" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-white/20" />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        "flex-1 font-medium",
                        step.completed && "text-white/50 line-through",
                        isCurrent && "text-white",
                        !step.completed && !isCurrent && "text-white/40"
                      )}
                    >
                      {step.label}
                    </span>

                    {/* Arrow for actionable items */}
                    {!step.completed && (
                      <ChevronRight className="h-4 w-4 text-white/30" />
                    )}
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </section>

        {/* ============================================
            4. PIPELINE SNAPSHOT (4 metrics with empty state guidance)
        ============================================ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
            Pipeline
          </h2>
          {outreachCount === 0 ? (
            <Card className="bg-white/[0.03] border border-white/10 rounded-xl">
              <CardContent className="p-6 text-center">
                <Send className="h-8 w-8 text-white/20 mx-auto mb-3" />
                <p className="text-white/60 mb-1">Your pipeline is empty</p>
                <p className="text-sm text-white/40 mb-4">
                  Send your first 20 messages to start building your pipeline.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                >
                  <Link href="/outreach">
                    Send Messages
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {pipelineStats.map((stat) => {
                const Icon = stat.icon
                const isActive = stat.value > 0
                return (
                  <Card
                    key={stat.label}
                    className={cn(
                      "border transition-all",
                      isActive
                        ? "bg-[#00AAFF]/10 border-[#00AAFF]/30"
                        : "bg-white/[0.03] border-white/10"
                    )}
                  >
                    <CardContent className="p-4 text-center">
                      <Icon
                        className={cn(
                          "h-5 w-5 mx-auto mb-2",
                          isActive ? "text-[#00AAFF]" : "text-white/30"
                        )}
                      />
                      <p
                        className={cn(
                          "text-2xl font-bold",
                          isActive ? "text-white" : "text-white/40"
                        )}
                      >
                        {stat.value}
                      </p>
                      <p className="text-xs text-white/50 mt-1">{stat.label}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* ============================================
            5. QUICK ACTIONS (4 state-aware actions)
        ============================================ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/revival/opportunities">
                <Compass className="h-4 w-4 mr-2" />
                Browse niches
              </Link>
            </Button>
            <Button
              asChild
              className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
            >
              <Link href="/outreach">
                <Send className="h-4 w-4 mr-2" />
                Generate messages
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/outreach">
                <MessageSquare className="h-4 w-4 mr-2" />
                View replies
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/offer/my-offers">
                <FileText className="h-4 w-4 mr-2" />
                My offers
              </Link>
            </Button>
          </div>
        </section>

        
      </div>
    </div>
  )
}
