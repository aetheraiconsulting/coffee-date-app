import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  Target,
  Send,
  Phone,
  Handshake,
  MessageSquare,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"

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
    { data: nichesData },
    { data: campaigns },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("ghl_connections").select("id").eq("user_id", user.id),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("revival_campaigns").select("id, metrics").eq("user_id", user.id),
    supabase.from("revival_conversations").select("id, status").eq("user_id", user.id),
  ])

  // Calculate counts
  const ghlCount = ghlConnections?.length || 0
  const favouritesCount = nichesData?.filter((n) => n.is_favourite).length || 0
  const campaignsCount = campaigns?.length || 0
  const conversationsCount = conversations?.length || 0
  const winsCount = nichesData?.filter((n) => n.status === "Win").length || 0

  // Get first name
  const firstName = profile?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there"

  // Determine current day in the 14-day sprint (simulated - would come from user onboarding date)
  const currentDay = 3 // For demo purposes

  // Determine user's current stage and today's mission (DYNAMIC NEXT ACTION ENGINE)
  const getMissionData = () => {
    if (ghlCount === 0) {
      return {
        mission: "Connect Your GHL Account",
        subtext: "We'll pull in your contacts automatically",
        why: "This is the step that unlocks everything. Without this, you have no leads to work with.",
        cta: "Connect Now",
        href: "/revival/connect",
        timeEstimate: "~5 minutes",
      }
    }
    if (favouritesCount === 0) {
      return {
        mission: "Choose Your Target Niche",
        subtext: "We'll show you the best opportunities",
        why: "A focused niche converts 3x better. This decision shapes all your messaging.",
        cta: "Pick Your Niche",
        href: "/revival/opportunities",
        timeEstimate: "~10 minutes",
      }
    }
    if (conversationsCount < 20) {
      return {
        mission: "Send Your First 20 Messages",
        subtext: "We'll generate your messages. You'll send them in minutes.",
        why: "This is the step that creates your first replies. Without this, nothing moves.",
        cta: "Send Messages",
        href: "/revival",
        timeEstimate: "~15 minutes",
      }
    }
    const activeConversations = conversations?.filter(c => c.status === "active").length || 0
    if (activeConversations > 0) {
      return {
        mission: "Book Your First Call",
        subtext: `You have ${activeConversations} active conversation${activeConversations > 1 ? "s" : ""} waiting`,
        why: "Replies without calls don't close deals. This is where revenue starts.",
        cta: "View Conversations",
        href: "/revival",
        timeEstimate: "~10 minutes",
      }
    }
    return {
      mission: "Close Your First Deal",
      subtext: "You're in the final stretch",
      why: "Everything you've done leads here. Focus on delivering value in your calls.",
      cta: "View Pipeline",
      href: "/pipeline",
      timeEstimate: "~30 minutes",
    }
  }

  const missionData = getMissionData()

  // Calculate next steps checklist
  const getNextSteps = () => {
    const steps = []

    // Step 1: Create your offer / Choose niche
    if (favouritesCount === 0) {
      steps.push({
        label: "Choose your target niche",
        status: "not_started" as const,
        href: "/revival/opportunities",
      })
    } else {
      steps.push({
        label: "Choose your target niche",
        status: "complete" as const,
        href: "/revival/opportunities",
      })
    }

    // Step 2: Send outreach messages
    if (conversationsCount === 0) {
      steps.push({
        label: "Send outreach messages",
        status: favouritesCount > 0 ? "in_progress" as const : "not_started" as const,
        href: "/revival",
      })
    } else if (conversationsCount < 20) {
      steps.push({
        label: `Send outreach messages (${conversationsCount}/20)`,
        status: "in_progress" as const,
        href: "/revival",
      })
    } else {
      steps.push({
        label: "Send outreach messages",
        status: "complete" as const,
        href: "/revival",
      })
    }

    // Step 3: Book your first call
    const callsBooked = Math.floor(conversationsCount * 0.3 * 0.2) // Simulated
    if (callsBooked === 0) {
      steps.push({
        label: "Book your first call",
        status: "not_started" as const,
        href: "/pipeline",
      })
    } else {
      steps.push({
        label: "Book your first call",
        status: "complete" as const,
        href: "/pipeline",
      })
    }

    return steps.slice(0, 3) // Max 3 items
  }

  const nextSteps = getNextSteps()

  // Pipeline metrics (4 cards only as per spec)
  const leadsContacted = conversationsCount
  const replies = Math.floor(conversationsCount * 0.3)
  const callsBooked = Math.floor(replies * 0.2)
  const dealsClosed = winsCount

  const pipelineStats = [
    { label: "Leads Contacted", value: leadsContacted, icon: Send },
    { label: "Replies", value: replies, icon: MessageSquare },
    { label: "Calls Booked", value: callsBooked, icon: Phone },
    { label: "Deals Closed", value: dealsClosed, icon: Handshake },
  ]

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        {/* ============================================
            1. TODAY'S MISSION (PRIMARY FOCUS)
        ============================================ */}
        <section>
          <Card className="bg-gradient-to-br from-[#00AAFF]/15 via-[#00AAFF]/5 to-transparent border-2 border-[#00AAFF]/30 rounded-2xl shadow-xl shadow-[#00AAFF]/10 overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="space-y-6">
                {/* Label */}
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#00AAFF]" />
                  <span className="text-sm font-semibold text-[#00AAFF] uppercase tracking-wide">
                    Today&apos;s Mission
                  </span>
                </div>

                {/* Mission text */}
                <div className="space-y-3">
                  <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
                    {missionData.mission}
                  </h1>
                  <div className="space-y-1">
                    <p className="text-white/80 text-base">
                      {missionData.subtext}
                    </p>
                    <p className="text-white/50 text-sm">
                      {missionData.why}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="space-y-2">
                  <Button
                    asChild
                    size="lg"
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/40 transition-all duration-200 h-12 px-8 text-base"
                  >
                    <Link href={missionData.href}>
                      {missionData.cta}
                      <ChevronRight className="h-5 w-5 ml-2" />
                    </Link>
                  </Button>
                  <p className="text-xs text-white/40">
                    This should take you {missionData.timeEstimate}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ============================================
            2. PROGRESS TRACKER (14-day sprint)
        ============================================ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/70">
              Day {currentDay} of 14 – First Client Sprint
            </span>
            <span className="text-xs text-white/40">
              {Math.round((currentDay / 14) * 100)}% complete
            </span>
          </div>
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00AAFF] to-[#00AAFF]/70 rounded-full transition-all duration-500"
              style={{ width: `${(currentDay / 14) * 100}%` }}
            />
            {/* Day markers */}
            <div className="absolute inset-0 flex justify-between px-1">
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 h-full",
                    i + 1 <= currentDay ? "bg-transparent" : "bg-white/5"
                  )}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            3. YOUR PATH TO FIRST CLIENT (Dynamic checklist)
        ============================================ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
            Your Path to First Client
          </h2>
          <Card className="bg-white/[0.03] border border-white/10 rounded-xl">
            <CardContent className="p-0">
              {nextSteps.map((step, index) => (
                <Link
                  key={index}
                  href={step.href}
                  className={cn(
                    "flex items-center gap-4 p-4 transition-all hover:bg-white/[0.03]",
                    index !== nextSteps.length - 1 && "border-b border-white/10"
                  )}
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {step.status === "complete" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    ) : step.status === "in_progress" ? (
                      <Loader2 className="h-5 w-5 text-[#00AAFF] animate-spin" />
                    ) : (
                      <Circle className="h-5 w-5 text-white/30" />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "flex-1 font-medium",
                      step.status === "complete" && "text-white/50 line-through",
                      step.status === "in_progress" && "text-white",
                      step.status === "not_started" && "text-white/70"
                    )}
                  >
                    {step.label}
                  </span>

                  {/* Arrow for actionable items */}
                  {step.status !== "complete" && (
                    <ChevronRight className="h-4 w-4 text-white/30" />
                  )}
                </Link>
              ))}
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
          {leadsContacted === 0 ? (
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
                  <Link href="/revival">
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
            5. QUICK ACTIONS (Action-focused, not navigation)
        ============================================ */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
            >
              <Link href="/revival">
                <Send className="h-4 w-4 mr-2" />
                Send Messages
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/revival">
                <MessageSquare className="h-4 w-4 mr-2" />
                View Conversations
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Link href="/revival/opportunities">
                <Target className="h-4 w-4 mr-2" />
                Generate Messages
              </Link>
            </Button>
          </div>
        </section>

        {/* ============================================
            6. MOMENTUM / FEEDBACK SECTION
        ============================================ */}
        <section>
          <Card className="bg-white/[0.02] border border-white/10 rounded-xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </div>
              <p className="text-sm text-white/60">
                {conversationsCount === 0
                  ? "You're on track. Start your outreach today to get your first reply within 24-48 hours."
                  : conversationsCount < 20
                  ? `Keep going! You've contacted ${conversationsCount} leads. Most users get their first reply after 20 messages.`
                  : replies > 0
                  ? `Great momentum! You have ${replies} replies. Focus on booking calls to close your first deal.`
                  : "You're on track. Most users get their first reply within 24-48 hours."}
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
