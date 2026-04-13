"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Send,
  MessageSquare,
  Coffee,
  Trophy,
  ChevronRight,
  Search,
  Clock,
  AlertCircle,
  Phone,
  Sparkles,
  Target,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type PipelineItem = {
  id: string
  name: string
  stage: "outreach" | "replied" | "coffee_date" | "won"
  niche: string
  service_name: string
  created_at: string
  note?: string
}

type NeedsAttentionItem = {
  id: string
  name: string
  type: "follow_up" | "reply_waiting" | "schedule_call"
  message: string
  href: string
}

export default function PipelinePage() {
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([])
  const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [metrics, setMetrics] = useState({
    leadsContacted: 0,
    replies: 0,
    calls: 0,
    proposalsSent: 0,
    dealsWon: 0,
  })

  const supabase = createClient()

  const loadPipelineData = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Fetch all metric counts in parallel from Phase 1 tables
    const [
      { count: leadsContacted },
      { count: repliesCount },
      { count: callsCount },
      { count: proposalsSent },
      { count: dealsWon },
    ] = await Promise.all([
      supabase
        .from("outreach_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "sent"),
      supabase
        .from("reply_threads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("call_scripts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("call_completed", true),
      supabase
        .from("proposals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("sent", true),
      supabase
        .from("proposals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("deal_status", "won"),
    ])

    setMetrics({
      leadsContacted: leadsContacted || 0,
      replies: repliesCount || 0,
      calls: callsCount || 0,
      proposalsSent: proposalsSent || 0,
      dealsWon: dealsWon || 0,
    })

    // Fetch pipeline items from Phase 1 tables
    const [
      { data: outreachItems },
      { data: replyItems },
      { data: callItems },
      { data: proposalItems },
    ] = await Promise.all([
      supabase
        .from("outreach_messages")
        .select("*, offers(service_name, niche)")
        .eq("user_id", user.id)
        .eq("status", "sent")
        .order("created_at", { ascending: false }),
      supabase
        .from("reply_threads")
        .select("*, outreach_messages(contact_name, offers(service_name, niche))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("call_scripts")
        .select("*, offers(service_name, niche)")
        .eq("user_id", user.id)
        .eq("call_completed", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("proposals")
        .select("*, offers(service_name, niche)")
        .eq("user_id", user.id)
        .eq("sent", true)
        .order("created_at", { ascending: false }),
    ])

    // Map to unified pipeline item format
    const items: PipelineItem[] = [
      ...(outreachItems?.map((m) => ({
        id: m.id,
        name: m.contact_name || "Prospect",
        stage: "outreach" as const,
        niche: m.offers?.niche || "",
        service_name: m.offers?.service_name || "",
        created_at: m.created_at,
        note: m.note || "",
      })) || []),

      ...(replyItems?.map((r) => ({
        id: r.id,
        name: r.outreach_messages?.contact_name || "Reply received",
        stage: "replied" as const,
        niche: r.outreach_messages?.offers?.niche || "",
        service_name: r.outreach_messages?.offers?.service_name || "",
        created_at: r.created_at,
      })) || []),

      ...(callItems?.map((c) => ({
        id: c.id,
        name: c.prospect_name || "Call completed",
        stage: "coffee_date" as const,
        niche: c.offers?.niche || "",
        service_name: c.offers?.service_name || "",
        created_at: c.created_at,
        note: c.call_notes || "",
      })) || []),

      ...(proposalItems?.map((p) => ({
        id: p.id,
        name: p.prospect_name || "Proposal sent",
        stage: "won" as const,
        niche: p.offers?.niche || "",
        service_name: p.offers?.service_name || "",
        created_at: p.created_at,
      })) || []),
    ]

    // Build needs attention list
    const attention: NeedsAttentionItem[] = []

    // Outreach items older than 3 days without follow-up
    outreachItems?.forEach((m) => {
      const daysSince = getDaysSince(new Date(m.created_at))
      if (daysSince > 3) {
        attention.push({
          id: m.id,
          name: m.contact_name || "Prospect",
          type: "follow_up",
          message: `No activity in ${daysSince} days`,
          href: "/outreach",
        })
      }
    })

    // Reply threads waiting for response
    replyItems?.forEach((r) => {
      if (!r.response_sent) {
        attention.push({
          id: r.id,
          name: r.outreach_messages?.contact_name || "Reply",
          type: "reply_waiting",
          message: "Reply waiting for your response",
          href: `/outreach/reply/${r.outreach_message_id}`,
        })
      }
    })

    setPipelineItems(items)
    setNeedsAttention(attention.slice(0, 6))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadPipelineData()
  }, [loadPipelineData])

  // Filter items
  const filteredItems = pipelineItems.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.niche.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.service_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "all" || item.stage === activeFilter
    return matchesSearch && matchesFilter
  })

  const isEmptyPipeline = pipelineItems.length === 0 && !loading

  // Dynamic next step based on actual counts
  const getNextStep = () => {
    if (metrics.leadsContacted === 0) {
      return { text: "Send your first 20 outreach messages", href: "/outreach" }
    }
    if (metrics.replies === 0) {
      return { text: "Monitor replies — first reply expected within 72hrs", href: "/outreach" }
    }
    if (metrics.calls === 0) {
      return { text: "Book a demo call with your warmest reply", href: "/outreach" }
    }
    if (metrics.proposalsSent === 0) {
      return { text: "Send your first proposal", href: "/proposal/builder" }
    }
    return { text: "You have proposals out — follow up and close", href: "/proposal/builder" }
  }

  const nextStep = getNextStep()

  return (
    <div className="min-h-screen bg-[#080B0F] relative">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00AAFF]/8 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8 relative">
        
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-sans">
              Pipeline
            </h1>
            <p className="text-white/50 text-lg mt-1">
              Track prospects from outreach to closed deals
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadPipelineData} 
              className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <Button
              asChild
              className="relative bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 px-6 shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/50 transition-all duration-200 active:scale-[0.98] group overflow-hidden"
            >
              <Link href="/outreach">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                Start your first outreach
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Next Step Strip - Dynamic */}
        <section>
          <Card className="bg-gradient-to-r from-[#00AAFF]/10 via-[#00AAFF]/5 to-transparent border border-[#00AAFF]/20 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00AAFF]" />
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-[#00AAFF]/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6 text-[#00AAFF]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">
                      Next Step: {nextStep.text}
                    </h2>
                    <p className="text-white/60">
                      {metrics.leadsContacted === 0 
                        ? "Send your first 20 messages to begin generating replies."
                        : metrics.replies === 0
                        ? "Keep sending messages while you wait for responses."
                        : metrics.calls === 0
                        ? "Reach out to your warmest replies and book a call."
                        : "Follow up on your active proposals to close deals."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <Button
                    asChild
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-11 px-6 shadow-lg shadow-[#00AAFF]/20"
                  >
                    <Link href={nextStep.href}>
                      Take Action
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Metrics Row */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={Send}
              label="Leads Contacted"
              value={metrics.leadsContacted}
              active={metrics.leadsContacted > 0}
              targetText={metrics.leadsContacted >= 20 ? "✓ Reached" : `${metrics.leadsContacted}/20`}
            />
            <MetricCard
              icon={MessageSquare}
              label="Replies"
              value={metrics.replies}
              active={metrics.replies > 0}
            />
            <MetricCard
              icon={Coffee}
              label="Calls (Coffee Dates)"
              value={metrics.calls}
              active={metrics.calls > 0}
            />
            <MetricCard
              icon={Trophy}
              label="Deals Won"
              value={metrics.dealsWon}
              active={metrics.dealsWon > 0}
              subLabel={metrics.proposalsSent > 0 ? `${metrics.proposalsSent} proposals sent` : undefined}
            />
          </div>
        </section>

        {/* Needs Attention */}
        {needsAttention.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white/80 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              Needs Attention
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {needsAttention.map((item) => (
                <Link key={item.id} href={item.href}>
                  <Card className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-all cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                          {item.type === "follow_up" && <Clock className="h-4 w-4 text-amber-400" />}
                          {item.type === "reply_waiting" && <MessageSquare className="h-4 w-4 text-amber-400" />}
                          {item.type === "schedule_call" && <Phone className="h-4 w-4 text-amber-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{item.name}</p>
                          <p className="text-sm text-amber-400/80">{item.message}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-amber-400/50 group-hover:text-amber-400 transition-colors shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Filters + Search */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search pipeline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/40 focus:border-[#00AAFF]/50 focus:ring-[#00AAFF]/20 h-11"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "all", label: "All", count: pipelineItems.length },
                { id: "outreach", label: "Outreach", count: pipelineItems.filter(i => i.stage === "outreach").length },
                { id: "replied", label: "Replied", count: pipelineItems.filter(i => i.stage === "replied").length },
                { id: "coffee_date", label: "Coffee Date", count: pipelineItems.filter(i => i.stage === "coffee_date").length },
                { id: "won", label: "Won", count: pipelineItems.filter(i => i.stage === "won").length },
              ].map((filter) => (
                <Button
                  key={filter.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "transition-all h-9 px-4",
                    activeFilter === filter.id
                      ? "bg-[#00AAFF] text-white hover:bg-[#0099EE]"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  {filter.label}
                  <span className={cn(
                    "ml-1.5 text-xs",
                    activeFilter === filter.id ? "text-white/80" : "text-white/40"
                  )}>
                    ({filter.count})
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline List / Empty State */}
        <section>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-2 border-[#00AAFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isEmptyPipeline ? (
            /* Enhanced Empty State */
            <Card className="bg-white/[0.03] border border-white/10 relative overflow-hidden">
              {/* Subtle glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00AAFF]/10 blur-[100px] rounded-full pointer-events-none" />
              <CardContent className="p-12 md:p-16 text-center relative">
                <div className="h-20 w-20 rounded-full bg-[#00AAFF]/10 border border-[#00AAFF]/20 flex items-center justify-center mx-auto mb-6">
                  <Target className="h-10 w-10 text-[#00AAFF]" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  {"Let's get your first client into the pipeline"}
                </h3>
                <p className="text-white/50 mb-8 max-w-md mx-auto leading-relaxed">
                  {"You don't have any active prospects yet. Your first step is sending outreach messages."}
                </p>
                <div className="flex flex-col items-center justify-center gap-3">
                  <Button
                    asChild
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 px-8 shadow-lg shadow-[#00AAFF]/30"
                  >
                    <Link href="/outreach">
                      Start Outreach
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                  <p className="text-xs text-white/40">
                    Generate and send your first messages
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : filteredItems.length === 0 ? (
            /* No results for filter */
            <Card className="bg-white/[0.03] border border-white/10">
              <CardContent className="p-12 text-center">
                <p className="text-white/50">No prospects match your search or filter.</p>
              </CardContent>
            </Card>
          ) : (
            /* Pipeline List */
            <Card className="bg-white/[0.03] border border-white/10 overflow-hidden">
              <div className="divide-y divide-white/10">
                {filteredItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.stage === "replied" ? "/outreach" : item.stage === "won" ? "/proposal/builder" : "/outreach"}
                    className="flex items-center gap-4 p-4 md:p-5 hover:bg-white/[0.03] transition-all group"
                  >
                    {/* Stage indicator */}
                    <div
                      className={cn(
                        "h-11 w-11 rounded-full flex items-center justify-center shrink-0",
                        item.stage === "won" && "bg-green-500/20 text-green-400",
                        item.stage === "coffee_date" && "bg-[#00AAFF]/20 text-[#00AAFF]",
                        item.stage === "replied" && "bg-purple-500/20 text-purple-400",
                        item.stage === "outreach" && "bg-white/10 text-white/60"
                      )}
                    >
                      {item.stage === "won" && <Trophy className="h-5 w-5" />}
                      {item.stage === "coffee_date" && <Coffee className="h-5 w-5" />}
                      {item.stage === "replied" && <MessageSquare className="h-5 w-5" />}
                      {item.stage === "outreach" && <Send className="h-5 w-5" />}
                    </div>

                    {/* Name and stage */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate group-hover:text-[#00AAFF] transition-colors">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            item.stage === "won" && "bg-green-500/20 text-green-400",
                            item.stage === "coffee_date" && "bg-[#00AAFF]/20 text-[#00AAFF]",
                            item.stage === "replied" && "bg-purple-500/20 text-purple-400",
                            item.stage === "outreach" && "bg-white/10 text-white/50"
                          )}
                        >
                          {item.stage === "won" && "Won"}
                          {item.stage === "coffee_date" && "Coffee Date"}
                          {item.stage === "replied" && "Replied"}
                          {item.stage === "outreach" && "Outreach"}
                        </span>
                        <span className="text-xs text-white/40">{formatTimeAgo(new Date(item.created_at))}</span>
                        {item.niche && <span className="text-xs text-white/30">{item.niche}</span>}
                      </div>
                    </div>

                    {/* Service name */}
                    <div className="hidden md:block text-right max-w-[180px]">
                      <p className="text-sm text-white/50 truncate">{item.service_name || "—"}</p>
                    </div>

                    {/* Open button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/50 hover:text-[#00AAFF] hover:bg-[#00AAFF]/10 transition-colors shrink-0"
                    >
                      Open
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}

// Metric Card Component
function MetricCard(props: {
  icon: React.ElementType
  label: string
  value: number
  active: boolean
  targetText?: string
  subLabel?: string
}) {
  const { icon: Icon, label, value, active, targetText, subLabel } = props
  return (
    <Card
      className={cn(
        "border transition-all",
        active
          ? "bg-[#00AAFF]/10 border-[#00AAFF]/30"
          : "bg-white/[0.03] border-white/10"
      )}
    >
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              active ? "bg-[#00AAFF]/20" : "bg-white/[0.05]"
            )}
          >
            <Icon
              className={cn("h-5 w-5", active ? "text-[#00AAFF]" : "text-white/40")}
            />
          </div>
        </div>
        <p
          className={cn(
            "text-3xl font-bold mb-1",
            active ? "text-[#00AAFF]" : "text-white/40"
          )}
        >
          {value}
        </p>
        <p
          className={cn(
            "text-sm font-medium mb-1",
            active ? "text-white" : "text-white/50"
          )}
        >
          {label}
        </p>
        {targetText && (
          <p className={cn(
            "text-[11px] mt-2 font-medium",
            active ? "text-green-400" : "text-[#00AAFF]/60"
          )}>
            {targetText}
          </p>
        )}
        {subLabel && (
          <p className="text-[11px] text-white/40 mt-1">{subLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Helper functions
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function getDaysSince(date: Date): number {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}
