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
  Flame,
  Clock,
  ChevronRight,
  Trophy,
  Star,
  FileText,
  Eye,
  Activity,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { cn } from "@/lib/utils"

// Journey steps configuration
const JOURNEY_STEPS = [
  { id: "ghl", label: "Connect GHL", href: "/revival", icon: MessageSquare, time: "5 min" },
  { id: "quiz", label: "Build AI Readiness Quiz", href: "/quiz/builder", icon: Sparkles, time: "10 min" },
  { id: "niches", label: "Browse Niches", href: "/revival/opportunities", icon: Target, time: "3 min" },
  { id: "android", label: "Create Android", href: "/prompt-generator", icon: Zap, time: "8 min" },
  { id: "campaign", label: "Launch Campaign", href: "/revival", icon: PlayCircle, time: "5 min" },
]

// Achievement badges configuration
const ACHIEVEMENTS = [
  { id: "first_ghl", label: "First GHL Account Connected", action: "Connect a GHL account", time: "5 min" },
  { id: "first_quiz", label: "First Quiz Built", action: "Create a quiz", time: "10 min" },
  { id: "first_niche", label: "First Niche Saved", action: "Save a niche to favourites", time: "2 min" },
  { id: "first_android", label: "First Android Created", action: "Create an Android", time: "8 min" },
  { id: "first_campaign", label: "First Campaign Launched", action: "Sync a GHL campaign", time: "5 min" },
  { id: "first_lead", label: "First Lead Revived", action: "Get a conversation response", time: "varies" },
  { id: "first_win", label: "First Client Win", action: "Mark a niche as Won", time: "varies" },
  { id: "streak_7", label: "7-Day Streak", action: "Log in for 7 consecutive days", time: "7 days" },
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
    { data: sessions },
    { data: androids },
    { data: quizzes },
    { data: nichesData },
    { data: campaigns },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("ghl_connections").select("id").eq("user_id", user.id),
    supabase.from("sessions").select("id").eq("user_id", user.id),
    supabase.from("androids").select("id").eq("user_id", user.id),
    supabase.from("quiz_templates").select("id").eq("user_id", user.id),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("revival_campaigns").select("id, metrics").eq("user_id", user.id),
    supabase.from("revival_conversations").select("id, status").eq("user_id", user.id),
  ])

  // Calculate counts
  const ghlCount = ghlConnections?.length || 0
  const sessionsCount = sessions?.length || 0
  const androidsCount = androids?.length || 0
  const quizzesCount = quizzes?.length || 0
  const favouritesCount = nichesData?.filter((n) => n.is_favourite).length || 0
  const campaignsCount = campaigns?.length || 0
  const conversationsCount = conversations?.length || 0
  const winsCount = nichesData?.filter((n) => n.status === "Win").length || 0
  const nichesViewedCount = nichesData?.length || 0

  // Get first name from profile or email
  const firstName = profile?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there"

  // Calculate journey progress
  const journeyProgress = {
    ghl: ghlCount > 0,
    quiz: quizzesCount > 0,
    niches: favouritesCount > 0,
    android: androidsCount > 0,
    campaign: campaignsCount > 0,
  }

  const completedSteps = Object.values(journeyProgress).filter(Boolean).length
  const totalSteps = JOURNEY_STEPS.length

  // Find first incomplete step
  const firstIncompleteStep = JOURNEY_STEPS.find((step) => !journeyProgress[step.id as keyof typeof journeyProgress])

  // Calculate achievements
  const unlockedAchievements = {
    first_ghl: ghlCount > 0,
    first_quiz: quizzesCount > 0,
    first_niche: favouritesCount > 0,
    first_android: androidsCount > 0,
    first_campaign: campaignsCount > 0,
    first_lead: conversationsCount > 0,
    first_win: winsCount > 0,
    streak_7: false, // This will need proper logic to track consecutive days
  }

  // Get recommended next action
  const getNextRecommendation = () => {
    if (ghlCount === 0)
      return {
        text: "Connect a GHL account to start tracking revivals.",
        href: "/revival",
        benefit: "Start tracking dead lead revivals",
      }
    if (quizzesCount === 0)
      return {
        text: "Build an AI quiz to qualify leads automatically.",
        href: "/quiz/builder",
        benefit: "Qualify leads on autopilot",
      }
    if (favouritesCount === 0)
      return {
        text: "Browse niches to find client-ready opportunities.",
        href: "/revival/opportunities",
        benefit: "Find your next paying client",
      }
    if (androidsCount === 0)
      return {
        text: "Create an Android to power your demos.",
        href: "/prompt-generator",
        benefit: "Demo ready in minutes",
      }
    if (campaignsCount === 0)
      return {
        text: "Sync your first campaign to start revivals.",
        href: "/revival",
        benefit: "Automate your outreach",
      }
    return {
      text: "Keep building momentum. Explore more niches.",
      href: "/revival/opportunities",
      benefit: "Scale your agency",
    }
  }

  const nextRecommendation = getNextRecommendation()

  // Metrics for snapshot with descriptions
  const metrics = [
    {
      label: "GHL Accounts",
      value: ghlCount,
      desc: ghlCount > 0 ? "Connected and tracking" : "Connect to start",
      icon: MessageSquare,
      href: "/revival",
    },
    {
      label: "Quizzes Created",
      value: quizzesCount,
      desc: quizzesCount > 0 ? "Ready to qualify leads" : "Build your first quiz",
      icon: FileText,
      href: "/quiz",
    },
    {
      label: "AI Androids",
      value: androidsCount,
      desc: androidsCount > 0 ? "Demo ready to send" : "Create your first",
      icon: Zap,
      href: "/demo",
    },
    {
      label: "Favourite Niches",
      value: favouritesCount,
      desc: favouritesCount > 0 ? "Pipeline started" : "Pipeline starts here",
      icon: Star,
      href: "/revival/opportunities",
    },
    {
      label: "Pipeline Value",
      // Basic estimation: 500 USD per niche. Needs proper calculation in a real app.
      value: favouritesCount > 0 ? `$${favouritesCount * 500}` : "$0",
      desc: favouritesCount > 0 ? "Estimated client opportunity" : "Start by saving a niche",
      icon: TrendingUp,
      href: "/revival/opportunities",
    },
  ]

  // Build recent activity feed
  const activityFeed = []
  if (androidsCount > 0)
    activityFeed.push({ icon: CheckCircle2, text: "Created first Android", color: "text-green-400", type: "milestone" })
  if (ghlCount > 0)
    activityFeed.push({ icon: CheckCircle2, text: "Connected GHL", color: "text-green-400", type: "milestone" })
  if (nichesViewedCount > 0)
    activityFeed.push({ icon: Eye, text: `Viewed ${nichesViewedCount} niches`, color: "text-blue-400", type: "action" })
  if (quizzesCount > 0)
    activityFeed.push({ icon: CheckCircle2, text: "Built first quiz", color: "text-green-400", type: "milestone" })
  if (activityFeed.length === 0)
    activityFeed.push({ icon: Activity, text: "No recent activity yet", color: "text-white/40", type: "action" })

  const actionStreak = completedSteps > 0 ? Math.min(completedSteps, 7) : 0

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-12">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00A8FF]/5 to-transparent pointer-events-none" />

        {/* A) HEADER with sticky CTA */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-8 border-b border-white/10 relative">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#00A8FF] to-[#0066FF] flex items-center justify-center text-white text-xl font-bold uppercase shadow-xl shadow-[#00A8FF]/30 ring-2 ring-white/10">
                {firstName[0]}
              </div>
              {completedSteps > 0 && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#00A8FF] flex items-center justify-center ring-2 ring-black">
                  <Flame className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-white/50">
              <Clock className="h-4 w-4" />
              <span>Last login: Today</span>
            </div>
          </div>
          {firstIncompleteStep && (
            <Button
              asChild
              className="bg-[#00A8FF] hover:bg-[#0099EE] active:scale-[0.98] text-white shadow-lg shadow-[#00A8FF]/30 transition-all duration-200 hover:shadow-xl hover:shadow-[#00A8FF]/40 h-9 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
            >
              <Link href={firstIncompleteStep.href}>
                Continue Next Step
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </header>

        {/* B) WELCOME BLOCK */}
        <section className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-white/60 text-lg max-w-xl">
            You're just a few steps away from unlocking your full potential.
          </p>
          <p className="text-[#00A8FF]/80 text-sm font-medium">Your goal: Launch your first client campaign.</p>
          <p className="text-white/40 text-sm">
            {completedSteps === 0
              ? "Users who complete the next step launch faster."
              : completedSteps < totalSteps
                ? `You're ahead of 82% of new users this week.`
                : "Amazing! You've mastered the platform."}
          </p>
        </section>

        {/* C) USER JOURNEY PROGRESS BAR */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Your Journey</h2>
              <p className="text-white/40 text-sm mt-1">Complete each step to unlock your agency potential</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Flame className={cn("h-4 w-4", actionStreak > 0 ? "text-orange-400" : "text-white/30")} />
              <span className={cn("text-sm font-medium", actionStreak > 0 ? "text-white" : "text-white/40")}>
                {actionStreak > 0 ? `${actionStreak}-Day Streak` : "Start your first action today"}
              </span>
            </div>
          </div>

          <Card className="bg-gradient-to-br from-white/[0.08] to-white/[0.02] rounded-2xl border border-white/10 shadow-xl shadow-black/20">
            <CardContent className="p-8">
              <div className="relative">
                {/* Progress line */}
                <div className="absolute top-6 left-0 right-0 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00A8FF] to-[#0066FF] rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                  />
                </div>

                {/* Steps - responsive vertical on mobile */}
                <div className="relative flex flex-col md:flex-row md:justify-between gap-6 md:gap-0">
                  {JOURNEY_STEPS.map((step, index) => {
                    const isComplete = journeyProgress[step.id as keyof typeof journeyProgress]
                    const isNext = step.id === firstIncompleteStep?.id
                    const Icon = step.icon

                    return (
                      <Link
                        key={step.id}
                        href={step.href}
                        title={`${step.label} - ${step.time}`}
                        className={cn(
                          "flex md:flex-col items-center gap-3 md:gap-2 group transition-all duration-300",
                          "hover:scale-105 active:scale-[0.98]",
                          isComplete ? "opacity-100" : isNext ? "opacity-100" : "opacity-40 hover:opacity-60",
                        )}
                      >
                        <div
                          className={cn(
                            "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300",
                            isComplete
                              ? "bg-[#00A8FF] text-white shadow-lg shadow-[#00A8FF]/40"
                              : isNext
                                ? "bg-white/10 text-[#00A8FF] border-2 border-[#00A8FF] shadow-lg shadow-[#00A8FF]/20 animate-pulse"
                                : "bg-white/5 text-white/40 border border-white/10 group-hover:border-white/20",
                          )}
                        >
                          {isComplete ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : isNext ? (
                            <Icon className="h-5 w-5" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex flex-col md:items-center">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              isComplete ? "text-white" : isNext ? "text-[#00A8FF]" : "text-white/40",
                            )}
                          >
                            {step.label}
                          </span>
                          <span className="text-xs text-white/30 md:hidden">{step.time}</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Next step CTA */}
              {firstIncompleteStep && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-8 mt-6 border-t border-white/10">
                  <span className="text-white/60 text-sm">
                    Next Step: <span className="text-white font-medium">{firstIncompleteStep.label}</span>
                  </span>
                  <Button
                    asChild
                    size="sm"
                    className="bg-[#00A8FF] hover:bg-[#0099EE] active:scale-[0.98] text-white transition-all duration-200 h-8 rounded-md gap-1.5 px-3"
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

        {/* D) QUICK ACTIONS ROW */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
            <p className="text-white/40 text-sm mt-1">Jump into your most common tasks</p>
          </div>
          <div className="flex md:grid md:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide">
            {/* Browse Niches */}
            <Link href="/revival/opportunities" className="min-w-[280px] md:min-w-0 snap-start">
              <Card className="group h-full border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] hover:border-[#00A8FF]/50 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-xl hover:shadow-[#00A8FF]/20 active:scale-[0.98] cursor-pointer rounded-xl">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-xl bg-[#00A8FF]/10 flex items-center justify-center border border-[#00A8FF]/20 group-hover:bg-[#00A8FF]/20 group-hover:scale-110 transition-all duration-300">
                      <Target className="h-6 w-6 text-[#00A8FF]" />
                    </div>
                    <span className="text-xs text-[#00A8FF] bg-[#00A8FF]/10 px-2.5 py-1 rounded-full font-medium">
                      3 min
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-[#00A8FF] transition-colors">
                      Browse Niches
                    </h3>
                    <p className="text-sm text-white/50 mt-1">Find client-ready opportunities</p>
                  </div>
                  <div className="flex items-center text-[#00A8FF] text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                    Get Started <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Create Android */}
            <Link href="/prompt-generator" className="min-w-[280px] md:min-w-0 snap-start">
              <Card className="group h-full border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] hover:border-[#00A8FF]/50 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-xl hover:shadow-[#00A8FF]/20 active:scale-[0.98] cursor-pointer rounded-xl">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-xl bg-[#00A8FF]/10 flex items-center justify-center border border-[#00A8FF]/20 group-hover:bg-[#00A8FF]/20 group-hover:scale-110 transition-all duration-300">
                      <Zap className="h-6 w-6 text-[#00A8FF]" />
                    </div>
                    <span className="text-xs text-[#00A8FF] bg-[#00A8FF]/10 px-2.5 py-1 rounded-full font-medium">
                      10 min
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-[#00A8FF] transition-colors">
                      Create Android
                    </h3>
                    <p className="text-sm text-white/50 mt-1">Build your first AI agent</p>
                  </div>
                  <div className="flex items-center text-[#00A8FF] text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                    Get Started <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Start Coffee Date Demo */}
            <Link href="/demo" className="min-w-[280px] md:min-w-0 snap-start">
              <Card className="group h-full border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] hover:from-white/[0.12] hover:to-white/[0.04] hover:border-[#00A8FF]/50 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-xl hover:shadow-[#00A8FF]/20 active:scale-[0.98] cursor-pointer rounded-xl">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="h-12 w-12 rounded-xl bg-[#00A8FF]/10 flex items-center justify-center border border-[#00A8FF]/20 group-hover:bg-[#00A8FF]/20 group-hover:scale-110 transition-all duration-300">
                      <PlayCircle className="h-6 w-6 text-[#00A8FF]" />
                    </div>
                    <span className="text-xs text-[#00A8FF] bg-[#00A8FF]/10 px-2.5 py-1 rounded-full font-medium">
                      2 min
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-[#00A8FF] transition-colors">
                      Start Coffee Date Demo
                    </h3>
                    <p className="text-sm text-white/50 mt-1">Test conversations instantly</p>
                  </div>
                  <div className="flex items-center text-[#00A8FF] text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                    Get Started <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
          <div className="flex md:hidden justify-center gap-1.5 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1.5 w-1.5 rounded-full bg-white/20" />
            ))}
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* E) ACHIEVEMENTS SECTION */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Achievements</h2>
            <p className="text-white/40 text-sm mt-1">Unlock badges as you progress through the platform</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ACHIEVEMENTS.map((achievement) => {
              const isUnlocked = unlockedAchievements[achievement.id as keyof typeof unlockedAchievements]
              return (
                <div
                  key={achievement.id}
                  className={cn(
                    "relative p-4 rounded-xl border transition-all duration-300 group cursor-default",
                    isUnlocked
                      ? "bg-gradient-to-br from-[#00A8FF]/20 to-[#00A8FF]/5 border-[#00A8FF]/30 shadow-lg shadow-[#00A8FF]/15 hover:shadow-xl hover:shadow-[#00A8FF]/25"
                      : "bg-white/[0.03] border-white/10 opacity-50 hover:opacity-70 hover:bg-white/[0.05]",
                  )}
                  title={isUnlocked ? "Unlocked!" : `How to unlock: ${achievement.action} (~${achievement.time})`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110",
                        isUnlocked ? "bg-[#00A8FF] shadow-md shadow-[#00A8FF]/30" : "bg-white/10",
                      )}
                    >
                      {isUnlocked ? (
                        <Trophy className="h-5 w-5 text-white" />
                      ) : (
                        <Lock className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                    <span
                      className={cn("text-xs font-medium leading-tight", isUnlocked ? "text-white" : "text-white/40")}
                    >
                      {achievement.label}
                    </span>
                  </div>
                  {isUnlocked && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#00A8FF] flex items-center justify-center shadow-lg ring-2 ring-black">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* F) YOUR METRICS */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Your Metrics</h2>
            <p className="text-white/40 text-sm mt-1">Track your progress at a glance</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <Link key={metric.label} href={metric.href}>
                  <Card className="border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent hover:from-white/[0.10] hover:to-white/[0.02] hover:border-[#00A8FF]/50 transition-all duration-300 cursor-pointer hover:scale-[1.03] hover:-translate-y-1 hover:shadow-lg hover:shadow-[#00A8FF]/10 active:scale-[0.98] rounded-xl">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#00A8FF]/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <Icon className="h-5 w-5 text-[#00A8FF]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-2xl font-bold text-white">{metric.value}</div>
                          <div className="text-xs text-white/60 truncate font-medium">{metric.label}</div>
                          <div className="text-xs text-white/30 mt-1 truncate">{metric.desc}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* G) ACTIVITY FEED */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
              <p className="text-white/40 text-sm mt-1">Your latest actions and milestones</p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-white/5 rounded-full border border-white/10">
              <button className="px-3 py-1 text-xs font-medium text-white bg-white/10 rounded-full transition-colors">
                All
              </button>
              <button className="px-3 py-1 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                Milestones
              </button>
              <button className="px-3 py-1 text-xs font-medium text-white/50 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                Actions
              </button>
            </div>
          </div>
          <Card className="border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent rounded-xl">
            <CardContent className="p-5 space-y-4">
              {activityFeed.slice(0, 3).map((item, index) => {
                const Icon = item.icon
                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 text-sm group hover:bg-white/5 -mx-2 px-2 py-2 rounded-lg transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Icon className={cn("h-4 w-4 shrink-0", item.color)} />
                    </div>
                    <span className="text-white/70 group-hover:text-white transition-colors">{item.text}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </section>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* H) YOUR NEXT MOVE - Priority Card */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Your Next Move</h2>
            <p className="text-white/40 text-sm mt-1">Personalized recommendation based on your progress</p>
          </div>
          <Card className="border-2 border-[#00A8FF]/40 bg-gradient-to-r from-[#00A8FF]/15 via-[#00A8FF]/5 to-transparent shadow-xl shadow-[#00A8FF]/10 rounded-xl overflow-hidden relative">
            {/* Subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#00A8FF]/10 to-transparent pointer-events-none" />
            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-[#00A8FF]/20 flex items-center justify-center border border-[#00A8FF]/30 shadow-lg shadow-[#00A8FF]/20">
                  <Target className="h-8 w-8 text-[#00A8FF]" />
                </div>
                <div>
                  <p className="text-sm text-white/50 font-medium uppercase tracking-wide">Recommended Next Action</p>
                  <p className="text-white font-semibold text-lg mt-1">{nextRecommendation.text}</p>
                  <p className="text-[#00A8FF] text-sm mt-2 font-medium">{nextRecommendation.benefit}</p>
                </div>
              </div>
              <Button
                asChild
                size="lg"
                className="bg-[#00A8FF] hover:bg-[#0099EE] active:scale-[0.98] text-white shrink-0 shadow-lg shadow-[#00A8FF]/20 hover:shadow-xl hover:shadow-[#00A8FF]/30 transition-all duration-200 ring-2 ring-transparent hover:ring-[#00A8FF]/50 h-9 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium"
              >
                <Link href={nextRecommendation.href}>
                  {nextRecommendation.text.split(".")[0]}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* FOOTER CTA */}
        <section className="pt-10 mt-4">
          {/* Divider line */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-10" />

          <div className="text-center space-y-8">
            <p className="text-white/50 text-lg italic font-light">"Build momentum. One action at a time."</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 hover:border-white/30 active:scale-[0.98] bg-transparent transition-all duration-200"
                asChild
              >
                <Link href="/demo">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Start Guided Tour
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 hover:border-white/30 active:scale-[0.98] bg-transparent transition-all duration-200"
                asChild
              >
                <Link href="/revival/opportunities">
                  <Target className="h-4 w-4 mr-2" />
                  Browse Niches
                </Link>
              </Button>
              <Button
                className="bg-[#00A8FF] hover:bg-[#0099EE] active:scale-[0.98] text-white shadow-lg shadow-[#00A8FF]/20 hover:shadow-xl hover:shadow-[#00A8FF]/30 transition-all duration-200 h-9 px-4 py-2 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium"
                asChild
              >
                <Link href="/prompt-generator">
                  <Zap className="h-4 w-4 mr-2" />
                  Create Android
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
