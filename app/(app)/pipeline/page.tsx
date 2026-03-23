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
  CheckCircle2,
  Users,
  Phone,
  Handshake,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Pipeline stages for deals
const PIPELINE_STAGES = [
  { id: "outreach", label: "Outreach", dbStatus: "Outreach in Progress" },
  { id: "replied", label: "Replied", dbStatus: null }, // Derived from conversation status
  { id: "coffee_date", label: "Coffee Date", dbStatus: "Coffee Date Demo" },
  { id: "won", label: "Won", dbStatus: "Win" },
]

type PipelineItem = {
  id: string
  name: string
visibleStage: string
  lastActivity: string
  nextAction: string
  nicheId: string
  status: string
  conversationId?: string
  hasReply?: boolean
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
    dealsClosed: 0,
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

    // Fetch niches that are in active pipeline stages (not Research or Shortlisted)
    const { data: nicheStates } = await supabase
      .from("niche_user_state")
      .select(`
        id,
        niche_id,
        status,
        updated_at,
        outreach_channels,
        outreach_messages_sent,
        coffee_date_completed,
        win_completed
      `)
      .eq("user_id", user.id)
      .in("status", ["Outreach in Progress", "Coffee Date Demo", "Win"])

    // Fetch niche names
    const nicheIds = nicheStates?.map((n) => n.niche_id) || []
    const { data: niches } = await supabase
      .from("niches")
      .select("id, niche_name")
      .in("id", nicheIds)

    const nicheMap = new Map(niches?.map((n) => [n.id, n.niche_name]) || [])

    // Fetch conversations for reply tracking
    const { data: conversations } = await supabase
      .from("revival_conversations")
      .select("id, contact_name, status, last_message_at, updated_at")
      .eq("user_id", user.id)

    // Build pipeline items
    const items: PipelineItem[] = []
    const attention: NeedsAttentionItem[] = []

    // Add niche-based items
    nicheStates?.forEach((state) => {
      const nicheName = nicheMap.get(state.niche_id) || "Unknown Niche"
      const lastActivity = state.updated_at
        ? formatTimeAgo(new Date(state.updated_at))
        : "No activity"

      let visibleStage = "outreach"
      let nextAction = "Send follow-up message"

      if (state.status === "Win") {
        visibleStage = "won"
        nextAction = "Deal closed"
      } else if (state.status === "Coffee Date Demo") {
        visibleStage = "coffee_date"
        nextAction = state.coffee_date_completed
          ? "Follow up after demo"
          : "Schedule coffee date"
      } else if (state.status === "Outreach in Progress") {
        visibleStage = "outreach"
        const messagesSent = state.outreach_messages_sent || 0
        nextAction = messagesSent === 0 ? "Send first message" : "Send follow-up"
      }

      items.push({
        id: state.id,
        name: nicheName,
        visibleStage,
        lastActivity,
        nextAction,
        nicheId: state.niche_id,
        status: state.status || "",
      })

      // Check if needs attention
      if (state.updated_at) {
        const daysSince = getDaysSince(new Date(state.updated_at))
        if (state.status === "Outreach in Progress" && daysSince > 3) {
          attention.push({
            id: state.id,
            name: nicheName,
            type: "follow_up",
            message: `No activity in ${daysSince} days`,
            href: "/revival/opportunities",
          })
        }
        if (state.status === "Coffee Date Demo" && !state.coffee_date_completed && daysSince > 2) {
          attention.push({
            id: state.id,
            name: nicheName,
            type: "schedule_call",
            message: "Coffee date not yet scheduled",
            href: "/revival/opportunities",
          })
        }
      }
    })

    // Add conversation-based items (replied status)
    conversations?.forEach((conv) => {
      if (conv.status === "replied" || conv.status === "active") {
        const lastActivity = conv.last_message_at || conv.updated_at
          ? formatTimeAgo(new Date(conv.last_message_at || conv.updated_at))
          : "No activity"

        items.push({
          id: conv.id,
          name: conv.contact_name || "Unknown Contact",
          visibleStage: "replied",
          lastActivity,
          nextAction: "Continue conversation",
          nicheId: "",
          status: conv.status,
          conversationId: conv.id,
          hasReply: true,
        })

        // Check if needs attention
        if (conv.status === "active" && conv.updated_at) {
          const daysSince = getDaysSince(new Date(conv.updated_at))
          if (daysSince > 1) {
            attention.push({
              id: conv.id,
              name: conv.contact_name || "Unknown Contact",
              type: "reply_waiting",
              message: "Reply waiting for response",
              href: "/revival",
            })
          }
        }
      }
    })

    // Calculate metrics
    const leadsContacted = nicheStates?.filter(
      (n) => (n.outreach_messages_sent || 0) > 0
    ).length || 0
    const replies = conversations?.filter(
      (c) => c.status === "replied" || c.status === "active"
    ).length || 0
    const calls = nicheStates?.filter(
      (n) => n.status === "Coffee Date Demo"
    ).length || 0
    const dealsClosed = nicheStates?.filter(
      (n) => n.status === "Win"
    ).length || 0

    setMetrics({ leadsContacted, replies, calls, dealsClosed })
    setPipelineItems(items)
    setNeedsAttention(attention)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadPipelineData()
  }, [loadPipelineData])

  // Filter items
  const filteredItems = pipelineItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "all" || item.visibleStage === activeFilter
    return matchesSearch && matchesFilter
  })

  // Group by stage for display
  const groupedItems = {
    outreach: filteredItems.filter((i) => i.visibleStage === "outreach"),
    replied: filteredItems.filter((i) => i.visibleStage === "replied"),
    coffee_date: filteredItems.filter((i) => i.visibleStage === "coffee_date"),
    won: filteredItems.filter((i) => i.visibleStage === "won"),
  }

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00AAFF]/5 to-transparent pointer-events-none" />

        {/* Header */}
        <section className="space-y-4 relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                Pipeline
              </h1>
              <p className="text-white/50 text-lg mt-1">
                Track prospects from outreach to closed deals
              </p>
            </div>
            <Button
              asChild
              className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/40 transition-all duration-200 active:scale-[0.98] h-11 px-6"
            >
              <Link href="/revival">
                Start Outreach
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Metrics Row */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <MetricChip
              icon={Send}
              label="Leads Contacted"
              value={metrics.leadsContacted}
              active={metrics.leadsContacted > 0}
            />
            <MetricChip
              icon={MessageSquare}
              label="Replies"
              value={metrics.replies}
              active={metrics.replies > 0}
            />
            <MetricChip
              icon={Coffee}
              label="Calls (Coffee Dates)"
              value={metrics.calls}
              active={metrics.calls > 0}
            />
            <MetricChip
              icon={Trophy}
              label="Deals Closed"
              value={metrics.dealsClosed}
              active={metrics.dealsClosed > 0}
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
              {needsAttention.slice(0, 6).map((item) => (
                <Link key={item.id} href={item.href}>
                  <Card className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-all cursor-pointer">
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
                        <ChevronRight className="h-4 w-4 text-amber-400/50 shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search pipeline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/[0.05] border-white/10 text-white placeholder:text-white/40 focus:border-[#00AAFF]/50 focus:ring-[#00AAFF]/20"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "outreach", "replied", "coffee_date", "won"].map((filter) => (
                <Button
                  key={filter}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  className={cn(
                    "transition-all",
                    activeFilter === filter
                      ? "bg-[#00AAFF]/20 text-[#00AAFF] hover:bg-[#00AAFF]/30"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  {filter === "all" && "All"}
                  {filter === "outreach" && "Outreach"}
                  {filter === "replied" && "Replied"}
                  {filter === "coffee_date" && "Coffee Date"}
                  {filter === "won" && "Won"}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline List */}
        <section className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 border-2 border-[#00AAFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card className="bg-white/[0.03] border border-white/10">
              <CardContent className="p-12 text-center">
                <div className="h-16 w-16 rounded-full bg-white/[0.05] flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-white/30" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No prospects in pipeline</h3>
                <p className="text-white/50 mb-6 max-w-md mx-auto">
                  Start reaching out to prospects to see them here. Your pipeline tracks everyone from first contact to closed deal.
                </p>
                <Button
                  asChild
                  className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                >
                  <Link href="/revival">
                    Start Outreach
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/[0.03] border border-white/10 overflow-hidden">
              <div className="divide-y divide-white/10">
                {filteredItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.conversationId ? "/revival" : "/revival/opportunities"}
                    className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-all group"
                  >
                    {/* Stage indicator */}
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                        item.visibleStage === "won" && "bg-green-500/20 text-green-400",
                        item.visibleStage === "coffee_date" && "bg-[#00AAFF]/20 text-[#00AAFF]",
                        item.visibleStage === "replied" && "bg-purple-500/20 text-purple-400",
                        item.visibleStage === "outreach" && "bg-white/10 text-white/60"
                      )}
                    >
                      {item.visibleStage === "won" && <Trophy className="h-5 w-5" />}
                      {item.visibleStage === "coffee_date" && <Coffee className="h-5 w-5" />}
                      {item.visibleStage === "replied" && <MessageSquare className="h-5 w-5" />}
                      {item.visibleStage === "outreach" && <Send className="h-5 w-5" />}
                    </div>

                    {/* Name and stage */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate group-hover:text-[#00AAFF] transition-colors">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            item.visibleStage === "won" && "bg-green-500/20 text-green-400",
                            item.visibleStage === "coffee_date" && "bg-[#00AAFF]/20 text-[#00AAFF]",
                            item.visibleStage === "replied" && "bg-purple-500/20 text-purple-400",
                            item.visibleStage === "outreach" && "bg-white/10 text-white/50"
                          )}
                        >
                          {item.visibleStage === "won" && "Won"}
                          {item.visibleStage === "coffee_date" && "Coffee Date"}
                          {item.visibleStage === "replied" && "Replied"}
                          {item.visibleStage === "outreach" && "Outreach"}
                        </span>
                        <span className="text-xs text-white/40">{item.lastActivity}</span>
                      </div>
                    </div>

                    {/* Next action */}
                    <div className="hidden md:block text-right">
                      <p className="text-sm text-white/50">{item.nextAction}</p>
                    </div>

                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-[#00AAFF] transition-colors shrink-0" />
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

// Helper components
function MetricChip({
  icon: Icon,
  label,
  value,
  active,
}: {
  icon: React.ElementType
  label: string
  value: number
  active: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all",
        active ? "bg-[#00AAFF]/10 border-[#00AAFF]/30" : "bg-white/[0.03] border-white/10"
      )}
    >
      <Icon
        className={cn("h-5 w-5", active ? "text-[#00AAFF]" : "text-white/40")}
      />
      <span className={cn("text-2xl font-bold", active ? "text-[#00AAFF]" : "text-white/40")}>
        {value}
      </span>
      <span className={cn("text-sm font-medium", active ? "text-white" : "text-white/50")}>
        {label}
      </span>
    </div>
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
