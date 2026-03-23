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
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

// Pipeline stages for deals
const PIPELINE_STAGES = [
  { id: "outreach", label: "Outreach", dbStatus: "Outreach in Progress" },
  { id: "replied", label: "Replied", dbStatus: null },
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

    // Fetch niches that are in active pipeline stages
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

  const isEmptyPipeline = pipelineItems.length === 0 && !loading

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
          <Button
            asChild
            className="relative bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 px-6 shadow-lg shadow-[#00AAFF]/30 hover:shadow-xl hover:shadow-[#00AAFF]/50 transition-all duration-200 active:scale-[0.98] group overflow-hidden"
          >
            <Link href="/revival">
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              Start your first outreach
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </section>

        {/* Next Step Strip - Critical Guidance */}
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
                      Next Step: Start your first outreach campaign
                    </h2>
                    <p className="text-white/60">
                      Send your first 20 messages to begin generating replies.
                    </p>
                    <p className="text-white/40 text-sm mt-1">
                      This is how your pipeline starts.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end gap-2">
                  <Button
                    asChild
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-11 px-6 shadow-lg shadow-[#00AAFF]/20"
                  >
                    <Link href="/revival">
                      Start Outreach
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                  <p className="text-xs text-white/40">
                    Most users who send 20 messages get 2-5 replies
                  </p>
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
              helperText="Start outreach to begin tracking"
              targetText="Target: 20 messages"
            />
            <MetricCard
              icon={MessageSquare}
              label="Replies"
              value={metrics.replies}
              active={metrics.replies > 0}
              helperText="Appears after first responses"
              estimated
            />
            <MetricCard
              icon={Coffee}
              label="Calls (Coffee Dates)"
              value={metrics.calls}
              active={metrics.calls > 0}
              helperText="Booked from replies"
            />
            <MetricCard
              icon={Trophy}
              label="Deals Closed"
              value={metrics.dealsClosed}
              active={metrics.dealsClosed > 0}
              helperText="Closed clients"
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
                { id: "outreach", label: "Outreach", count: pipelineItems.filter(i => i.visibleStage === "outreach").length },
                { id: "replied", label: "Replied", count: pipelineItems.filter(i => i.visibleStage === "replied").length },
                { id: "coffee_date", label: "Coffee Date", count: pipelineItems.filter(i => i.visibleStage === "coffee_date").length },
                { id: "won", label: "Won", count: pipelineItems.filter(i => i.visibleStage === "won").length },
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
                  {"You don't have any active prospects yet. Your first step is choosing a niche and sending outreach."}
                </p>
                <div className="flex flex-col items-center justify-center gap-3">
                  <Button
                    asChild
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 px-8 shadow-lg shadow-[#00AAFF]/30"
                  >
                    <Link href="/revival/opportunities">
                      Browse Opportunities
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                  <p className="text-xs text-white/40">
                    Choose a niche, then start outreach
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
                    href={item.conversationId ? "/revival" : "/revival/opportunities"}
                    className="flex items-center gap-4 p-4 md:p-5 hover:bg-white/[0.03] transition-all group"
                  >
                    {/* Stage indicator */}
                    <div
                      className={cn(
                        "h-11 w-11 rounded-full flex items-center justify-center shrink-0",
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
                      <p className="font-semibold text-white truncate group-hover:text-[#00AAFF] transition-colors">
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
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
                    <div className="hidden md:block text-right max-w-[180px]">
                      <p className="text-sm text-white/50 truncate">{item.nextAction}</p>
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
  helperText: string
  estimated?: boolean
  targetText?: string
}) {
  const { icon: Icon, label, value, active, helperText, estimated, targetText } = props
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
          {estimated && value === 0 && (
            <span className="text-[10px] uppercase tracking-wider text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded">
              est.
            </span>
          )}
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
        {value === 0 && (
          <p className="text-xs text-white/30 mt-2">{helperText}</p>
        )}
        {targetText && !active && (
          <p className="text-[11px] text-[#00AAFF]/60 mt-2 font-medium">{targetText}</p>
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
