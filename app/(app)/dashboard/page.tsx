import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  PlayCircle,
  Sparkles,
  Zap,
  Target,
  CheckCircle2,
  Lock,
  ChevronRight,
  FileText,
  Users,
  Phone,
  Handshake,
  Send,
  Coffee,
  Library,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"

// Journey steps configuration - updated for client acquisition focus
const JOURNEY_STEPS = [
  { id: "ghl", label: "Connect GHL", href: "/revival", icon: MessageSquare },
  { id: "audit", label: "Generate AI Audit", href: "/audit", icon: FileText },
  { id: "niche", label: "Choose Target Niche", href: "/revival/opportunities", icon: Target },
  { id: "outreach", label: "Launch Outreach", href: "/revival", icon: Send },
  { id: "deal", label: "Close First Deal", href: "/revival/opportunities", icon: Handshake },
]

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Fetch user profile
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single()

  // Fetch all metrics in parallel
  const [
    { data: ghlConnections },
    { data: androids },
    { data: quizzes },
    { data: nichesData },
    { data: campaigns },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("ghl_connections").select("id").eq("user_id", user.id),
    supabase.from("androids").select("id").eq("user_id", user.id),
    supabase.from("quiz_templates").select("id").eq("user_id", user.id),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("revival_campaigns").select("id, metrics").eq("user_id", user.id),
    supabase.from("revival_conversations").select("id, status").eq("user_id", user.id),
  ])

  // Calculate counts
  const ghlCount = ghlConnections?.length || 0
  const androidsCount = androids?.length || 0
  const quizzesCount = quizzes?.length || 0
  const favouritesCount = nichesData?.filter((n) => n.is_favourite).length || 0
  const campaignsCount = campaigns?.length || 0
  const conversationsCount = conversations?.length || 0
  const winsCount = nichesData?.filter((n) => n.status === "Win").length || 0

  // Get first name from profile or email
  const firstName = profile?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there"

  // Calculate journey progress
  const journeyProgress = {
    ghl: ghlCount > 0,
    audit: androidsCount > 0, // Using androids as proxy for audit generation
    niche: favouritesCount > 0,
    outreach: campaignsCount > 0,
    deal: winsCount > 0,
  }

  const completedSteps = Object.values(journeyProgress).filter(Boolean).length
  const totalSteps = JOURNEY_STEPS.length

  // Find first incomplete step
  const firstIncompleteStep = JOURNEY_STEPS.find((step) => !journeyProgress[step.id as keyof typeof journeyProgress])

  // Pipeline metrics - simulate for now, would come from real data
  const leadsContacted = conversationsCount
  const replies = Math.floor(conversationsCount * 0.3)
  const activeConversations = conversations?.filter((c) => c.status === "active").length || 0
  const callsBooked = Math.floor(replies * 0.2)
  const dealsClosed = winsCount

  const pipelineStats = [
    { label: "Leads Contacted", value: leadsContacted, active: leadsContacted > 0 },
    { label: "Replies", value: replies, active: replies > 0 },
    { label: "Conversations", value: activeConversations, active: activeConversations > 0 },
    { label: "Calls Booked", value: callsBooked, active: callsBooked > 0 },
    { label: "Deals Closed", value: dealsClosed, active: dealsClosed > 0 },
  ]

  // Get the next action based on progress
  const getNextAction = () => {
    if (ghlCount === 0) return { action: "Connect your GHL account", href: "/revival" }
    if (androidsCount === 0) return { action: "Generate your first AI audit", href: "/audit" }
    if (favouritesCount === 0) return { action: "Choose your target niche", href: "/revival/opportunities" }
    if (campaignsCount === 0) return { action: "Send your first 20 outreach messages", href: "/revival" }
    return { action: "Follow up with active conversations", href: "/revival" }
  }

  const nextAction = getNextAction()

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-10">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00AAFF]/5 to-transparent pointer-events-none" />

        {/* ============================================
            MISSION CONTROL - TOP SECTION
        ============================================ */}
        <section className="space-y-8 relative">
          {/* Main heading */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Let's get you your first client
            </h1>
            <p className="text-white/50 text-lg">
              You're one step away from booking your first call
            </p>
          </div>

          {/* Primary Mission Card */}
          <Card className="bg-gradient-to-br from-[#00AAFF]/15 via-[#00AAFF]/5 to-transparent border-2 border-[#00AAFF]/30 rounded-2xl shadow-xl shadow-[#00AAFF]/10 overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-[#00AAFF]" />
                    <span className="text-sm font-semibold text-[#00AAFF] uppercase tracking-wide">Objective</span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-white">Book your first client call</p>
                  <div className="flex items-center gap-2 text-white/60">
                    <ChevronRight className="h-4 w-4 text-[#00AAFF]" />
                    <span className="text-sm">Next Action: <span className="text-white font-medium">{nextAction.action}</span></span>
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/40 transition-all duration-200 active:scale-[0.98] h-12 px-8 text-base"
                  >
                    <Link href={nextAction.href}>
                      Start Outreach
                      <ChevronRight className="h-5 w-5 ml-2" />
                    </Link>
                  </Button>
                  <p className="text-xs text-white/40">Most users get their first reply within 24–72 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============================================
            PIPELINE SECTION
        ============================================ */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white/80">Your Pipeline</h2>
          <div className="flex flex-wrap gap-3">
            {pipelineStats.map((stat) => (
              <div
                key={stat.label}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
                  stat.active
                    ? "bg-[#00AAFF]/10 border-[#00AAFF]/30"
                    : "bg-white/[0.03] border-white/10"
                )}
              >
                <span className={cn(
                  "text-2xl font-bold",
                  stat.active ? "text-[#00AAFF]" : "text-white/40"
                )}>
                  {stat.value}
                </span>
                <span className={cn(
                  "text-sm font-medium",
                  stat.active ? "text-white" : "text-white/50"
                )}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ============================================
            JOURNEY SECTION
        ============================================ */}
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white/80">Your Journey to First Client</h2>
            <p className="text-white/40 text-sm mt-1">Complete each step to close your first deal</p>
          </div>

          <Card className="bg-white/[0.03] border border-white/10 rounded-2xl">
            <CardContent className="p-6 md:p-8">
              {/* Journey Steps */}
              <div className="space-y-1">
                {JOURNEY_STEPS.map((step, index) => {
                  const isComplete = journeyProgress[step.id as keyof typeof journeyProgress]
                  const isNext = step.id === firstIncompleteStep?.id
                  const isLocked = !isComplete && !isNext
                  const Icon = step.icon

                  return (
                    <Link
                      key={step.id}
                      href={isLocked ? "#" : step.href}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl transition-all duration-200",
                        isComplete && "bg-[#00AAFF]/10 hover:bg-[#00AAFF]/15",
                        isNext && "bg-[#00AAFF]/5 border border-[#00AAFF]/30 hover:bg-[#00AAFF]/10",
                        isLocked && "opacity-40 cursor-not-allowed",
                        !isLocked && "hover:scale-[1.01] active:scale-[0.99]"
                      )}
                    >
                      {/* Step indicator */}
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                          isComplete && "bg-[#00AAFF] text-white",
                          isNext && "bg-[#00AAFF]/20 text-[#00AAFF] border-2 border-[#00AAFF]",
                          isLocked && "bg-white/10 text-white/40"
                        )}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : isLocked ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>

                      {/* Step label */}
                      <div className="flex-1">
                        <span
                          className={cn(
                            "font-medium",
                            isComplete && "text-white",
                            isNext && "text-[#00AAFF]",
                            isLocked && "text-white/40"
                          )}
                        >
                          {index + 1}. {step.label}
                        </span>
                        {isComplete && (
                          <span className="ml-2 text-xs text-green-400 font-medium">Complete</span>
                        )}
                        {isNext && (
                          <span className="ml-2 text-xs text-[#00AAFF] font-medium">Next Step</span>
                        )}
                      </div>

                      {/* Action indicator */}
                      {(isComplete || isNext) && (
                        <ChevronRight className={cn(
                          "h-5 w-5",
                          isComplete ? "text-white/50" : "text-[#00AAFF]"
                        )} />
                      )}
                    </Link>
                  )
                })}
              </div>

              {/* Next step CTA */}
              {firstIncompleteStep && (
                <div className="flex items-center justify-between pt-6 mt-6 border-t border-white/10">
                  <span className="text-white/60 text-sm">
                    Next Step: <span className="text-[#00AAFF] font-medium">{firstIncompleteStep.label}</span>
                  </span>
                  <Button
                    asChild
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white transition-all duration-200 active:scale-[0.98]"
                  >
                    <Link href={firstIncompleteStep.href}>
                      Start Now
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* ============================================
            TOOLS SECTION (SECONDARY)
        ============================================ */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-white/80">Tools</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Outreach Tools */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">Outreach</h3>
              <div className="space-y-2">
                <Link href="/demo">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all group">
                    <div className="h-10 w-10 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
                      <Coffee className="h-5 w-5 text-[#00AAFF]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white group-hover:text-[#00AAFF] transition-colors">Coffee Date Demo</p>
                      <p className="text-xs text-white/40">Test conversations instantly</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#00AAFF] transition-colors" />
                  </div>
                </Link>
                <Link href="/revival">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all group">
                    <div className="h-10 w-10 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-[#00AAFF]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white group-hover:text-[#00AAFF] transition-colors">GHL Dead Lead Revival</p>
                      <p className="text-xs text-white/40">Revive dormant leads</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#00AAFF] transition-colors" />
                  </div>
                </Link>
              </div>
            </div>

            {/* Strategy Tools */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">Strategy</h3>
              <div className="space-y-2">
                <Link href="/quiz">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all group">
                    <div className="h-10 w-10 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-[#00AAFF]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white group-hover:text-[#00AAFF] transition-colors">AI Readiness Quiz</p>
                      <p className="text-xs text-white/40">Qualify leads automatically</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#00AAFF] transition-colors" />
                  </div>
                </Link>
                <Link href="/audit">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all group">
                    <div className="h-10 w-10 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-[#00AAFF]" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white group-hover:text-[#00AAFF] transition-colors">AI Audit</p>
                      <p className="text-xs text-white/40">Generate business insights</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#00AAFF] transition-colors" />
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wide">Resources</h3>
            <Link href="/library">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all group max-w-md">
                <div className="h-10 w-10 rounded-lg bg-[#00AAFF]/10 flex items-center justify-center">
                  <Library className="h-5 w-5 text-[#00AAFF]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white group-hover:text-[#00AAFF] transition-colors">Prompt Library</p>
                  <p className="text-xs text-white/40">Ready-to-use AI prompts</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#00AAFF] transition-colors" />
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
