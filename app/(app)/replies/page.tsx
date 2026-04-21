"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Search, Copy, Check, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type ReplyThread = {
  id: string
  prospect_reply: string
  suggested_response: string | null
  response_goal: string | null
  response_sent: boolean
  response_sent_at: string | null
  created_at: string
  outreach_messages: {
    message_text: string
    channel: string
    offer_id: string
    offers: { niche: string | null } | null
  } | null
}

type FilterKey = "all" | "pending" | "responded"

export default function RepliesPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [threads, setThreads] = useState<ReplyThread[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    loadThreads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadThreads = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from("reply_threads")
      .select("*, outreach_messages(message_text, channel, offer_id, offers(niche))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setThreads((data as ReplyThread[]) || [])
    setLoading(false)
  }

  const handleMarkResponded = async (threadId: string) => {
    const { error } = await supabase
      .from("reply_threads")
      .update({
        response_sent: true,
        response_sent_at: new Date().toISOString(),
      })
      .eq("id", threadId)

    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" })
      return
    }
    // Optimistically update locally so the UI flips immediately.
    setThreads(prev =>
      prev.map(t => (t.id === threadId ? { ...t, response_sent: true, response_sent_at: new Date().toISOString() } : t)),
    )
  }

  const handleCopy = (id: string, text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredThreads = threads.filter(t => {
    if (filter === "pending" && t.response_sent) return false
    if (filter === "responded" && !t.response_sent) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (t.prospect_reply || "").toLowerCase().includes(q) ||
        (t.suggested_response || "").toLowerCase().includes(q) ||
        (t.outreach_messages?.offers?.niche || "").toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = {
    all: threads.length,
    pending: threads.filter(t => !t.response_sent).length,
    responded: threads.filter(t => t.response_sent).length,
  }

  const tabs: Array<{ key: FilterKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending response" },
    { key: "responded", label: "Responded" },
  ]

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-4xl mx-auto py-8 px-6">
        {/* Claude Cowork Autopilot teaser */}
        <div className="border border-[#00AAFF]/20 bg-gradient-to-r from-[#00AAFF]/10 to-transparent rounded-xl p-4 mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-1">
              Coming soon &mdash; Autopilot mode
            </p>
            <p className="text-white font-semibold text-sm mb-1">
              Stop copy-pasting. Let Claude Cowork run your outreach.
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              Aether Revive is building direct Claude Cowork integration. Autopilot will send messages, monitor replies, and book demos automatically across LinkedIn, Instagram, and email.
            </p>
          </div>
          <span className="flex-shrink-0 text-xs bg-white/5 text-white/50 border border-white/10 px-3 py-1.5 rounded-full">
            Q2 2026
          </span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Replies</h1>
          <p className="text-white/40 text-sm">
            Track every prospect reply and respond with Claude&apos;s suggested language.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                filter === tab.key
                  ? "text-white border-[#00AAFF]"
                  : "text-white/40 border-transparent hover:text-white/70",
              )}
            >
              {tab.label}
              <span className="text-white/30 ml-1">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search replies..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-[#00AAFF]/40 focus:outline-none placeholder:text-white/30"
          />
        </div>

        {/* Threads list */}
        {loading ? (
          <div className="text-center py-12 text-white/30">Loading...</div>
        ) : filteredThreads.length === 0 ? (
          <div className="border border-white/10 rounded-xl p-12 text-center">
            <MessageCircle className="h-8 w-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm mb-2">
              {threads.length === 0 ? "No replies logged yet" : "No replies match your filter"}
            </p>
            {threads.length === 0 && (
              <p className="text-white/30 text-xs">
                When a prospect replies to your outreach, log it from the Outreach page
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredThreads.map(t => (
              <div key={t.id} className="border border-white/10 rounded-xl p-5 bg-white/[0.02]">
                {/* Meta row: niche, channel, date, status */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs text-white/50">
                    {t.outreach_messages?.offers?.niche || "Unknown niche"}
                  </span>
                  <span className="text-white/20 text-xs">&middot;</span>
                  <span className="text-xs text-white/50 capitalize">
                    {t.outreach_messages?.channel || "unknown"}
                  </span>
                  <span className="text-white/20 text-xs">&middot;</span>
                  <span className="text-xs text-white/40">
                    {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {t.response_sent ? (
                    <span className="ml-auto text-xs text-green-400 font-semibold flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Responded
                    </span>
                  ) : (
                    <span className="ml-auto text-xs text-amber-400 font-semibold">Pending</span>
                  )}
                </div>

                {/* Original outreach message (collapsed) */}
                {t.outreach_messages?.message_text && (
                  <details className="mb-3 group">
                    <summary className="text-white/30 text-xs uppercase tracking-wider cursor-pointer hover:text-white/50 list-none">
                      <span className="group-open:hidden">Show original outreach</span>
                      <span className="hidden group-open:inline">Hide original outreach</span>
                    </summary>
                    <p className="text-white/50 text-sm leading-relaxed mt-2 pl-3 border-l-2 border-white/10 py-1">
                      {t.outreach_messages.message_text}
                    </p>
                  </details>
                )}

                {/* Prospect reply */}
                <div className="mb-3">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1.5">Their reply</p>
                  <p className="text-white/80 text-sm leading-relaxed bg-white/[0.02] border-l-2 border-white/10 pl-3 py-2 whitespace-pre-wrap">
                    {t.prospect_reply}
                  </p>
                </div>

                {/* Suggested response */}
                {t.suggested_response && (
                  <div className="mb-3">
                    <p className="text-[#00AAFF] text-xs uppercase tracking-wider mb-1.5">Your response</p>
                    <p className="text-white/80 text-sm leading-relaxed bg-[#00AAFF]/[0.03] border-l-2 border-[#00AAFF]/30 pl-3 py-2 whitespace-pre-wrap">
                      {t.suggested_response}
                    </p>
                    {t.response_goal && (
                      <p className="text-white/30 text-xs mt-1.5">Goal: {t.response_goal}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleCopy(t.id, t.suggested_response || "")}
                    disabled={!t.suggested_response}
                    className="text-xs bg-white/5 text-white/60 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    {copiedId === t.id ? (
                      <>
                        <Check className="h-3 w-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy response
                      </>
                    )}
                  </button>
                  {!t.response_sent && (
                    <button
                      onClick={() => handleMarkResponded(t.id)}
                      className="text-xs bg-[#00AAFF]/15 text-[#00AAFF] hover:bg-[#00AAFF]/25 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Mark as responded
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
