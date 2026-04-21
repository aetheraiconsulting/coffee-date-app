"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Search, Briefcase, Loader2 } from "lucide-react"

// Unified "Clients" view. A client can appear via two paths:
//   1. A won proposal (deal_status === "won" on `proposals`)
//   2. A GHL-onboarded niche (niche_user_state.client_onboarded === true)
// Both sources are merged into a single list, deduped by business name where
// possible so the same account doesn't show up twice.
type ClientRow = {
  id: string
  name: string
  business: string | null
  niche: string | null
  won_at: string | null
  onboarded_at: string | null
  proposal_id: string | null
  niche_state_id: string | null
  ghl_connection_id: string | null
  types: ("won" | "onboarded")[]
}

type FilterKey = "all" | "won" | "onboarded"

// Aggregate summary across every GHL connection — shown above the per-client
// list so operators running multiple sub-accounts see total pipeline health
// without clicking into each connection individually.
type GhlAggregate = {
  totalConnections: number
  totalConversations: number
  totalReplies: number
  totalHotLeads: number
  averageResponseRate: number
}

const HOT_LEAD_KEYWORDS = [
  "book",
  "appointment",
  "schedule",
  "call",
  "interested",
  "yes",
]

export default function ClientsPage() {
  const supabase = createClient()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [ghlAggregate, setGhlAggregate] = useState<GhlAggregate | null>(null)

  useEffect(() => {
    void loadClients()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadClients = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const [{ data: wonProposals }, { data: onboardedNiches }, { data: ghlConnections }] = await Promise.all([
      supabase
        .from("proposals")
        .select("id, prospect_name, prospect_business, sent_at, deal_status, offers(niche)")
        .eq("user_id", user.id)
        .eq("deal_status", "won")
        .order("sent_at", { ascending: false }),
      supabase
        .from("niche_user_state")
        .select("id, niche_id, client_onboarded_at, niches(niche_name)")
        .eq("user_id", user.id)
        .eq("client_onboarded", true)
        .order("client_onboarded_at", { ascending: false }),
      supabase.from("ghl_connections").select("id, niche_id, account_name").eq("user_id", user.id),
    ])

    const clientMap = new Map<string, ClientRow>()

    wonProposals?.forEach((p) => {
      const key = p.prospect_business || p.prospect_name
      if (!key) return
      clientMap.set(key, {
        id: p.id,
        name: p.prospect_name || key,
        business: p.prospect_business,
        niche: ((p.offers as any)?.niche as string) || null,
        won_at: p.sent_at || null,
        onboarded_at: null,
        proposal_id: p.id,
        niche_state_id: null,
        ghl_connection_id: null,
        types: ["won"],
      })
    })

    onboardedNiches?.forEach((n) => {
      const nicheName = ((n.niches as any)?.niche_name as string) || null
      if (!nicheName) return

      const ghl = ghlConnections?.find((g) => g.niche_id === n.niche_id)
      const businessName = ghl?.account_name || nicheName

      const existing = clientMap.get(businessName)
      if (existing) {
        if (!existing.types.includes("onboarded")) existing.types.push("onboarded")
        existing.niche_state_id = n.id
        existing.ghl_connection_id = ghl?.id ?? null
        existing.onboarded_at = n.client_onboarded_at ?? existing.onboarded_at
        if (!existing.niche) existing.niche = nicheName
      } else {
        clientMap.set(businessName, {
          id: n.id,
          name: businessName,
          business: ghl?.account_name || null,
          niche: nicheName,
          won_at: null,
          onboarded_at: n.client_onboarded_at ?? null,
          proposal_id: null,
          niche_state_id: n.id,
          ghl_connection_id: ghl?.id ?? null,
          types: ["onboarded"],
        })
      }
    })

    setClients(Array.from(clientMap.values()))
    await loadGhlAggregate(user.id, ghlConnections || [])
    setLoading(false)
  }

  // Pull a 7-day rollup across every GHL connection the user owns. We keep
  // this in its own step so the per-client list renders even if the aggregate
  // query is slow or fails. Response rate is derived from
  // replies-per-conversation because revival_campaigns.metrics is free-form.
  const loadGhlAggregate = async (
    userId: string,
    connections: { id: string; niche_id?: string | null; account_name?: string | null }[],
  ) => {
    if (connections.length === 0) {
      setGhlAggregate(null)
      return
    }

    const connectionIds = connections.map((c) => c.id)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: conversations } = await supabase
      .from("revival_conversations")
      .select("id, status, last_message_at, messages")
      .eq("user_id", userId)
      .in("ghl_connection_id", connectionIds)
      .gte("last_message_at", sevenDaysAgo)

    const convos = conversations ?? []

    // Reply count = conversations currently in "open" status in the 7-day window.
    const totalReplies = convos.filter((c) => c.status === "open").length

    // Hot lead heuristic: scan the most recent inbound message body for booking
    // intent keywords. `messages` is a jsonb array on the conversation row.
    const totalHotLeads = convos.filter((c) => {
      const messages = Array.isArray(c.messages) ? c.messages : []
      const lastInbound = [...messages].reverse().find(
        (m: any) => m?.direction === "inbound" || m?.type === "inbound",
      )
      const body = String(lastInbound?.body ?? lastInbound?.message ?? "").toLowerCase()
      if (!body) return false
      return HOT_LEAD_KEYWORDS.some((kw) => body.includes(kw))
    }).length

    // Response rate = replies / conversations, averaged to a percentage. If the
    // user hasn't had any conversations in the window it's 0 rather than NaN.
    const averageResponseRate =
      convos.length > 0 ? (totalReplies / convos.length) * 100 : 0

    setGhlAggregate({
      totalConnections: connections.length,
      totalConversations: convos.length,
      totalReplies,
      totalHotLeads,
      averageResponseRate,
    })
  }

  const counts = {
    all: clients.length,
    won: clients.filter((c) => c.types.includes("won")).length,
    onboarded: clients.filter((c) => c.types.includes("onboarded")).length,
  }

  const filteredClients = clients.filter((c) => {
    if (filter === "won" && !c.types.includes("won")) return false
    if (filter === "onboarded" && !c.types.includes("onboarded")) return false
    if (search) {
      const q = search.toLowerCase()
      return (c.name || "").toLowerCase().includes(q) || (c.niche || "").toLowerCase().includes(q)
    }
    return true
  })

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-5xl mx-auto py-8 px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00AAFF]/10 border border-[#00AAFF]/20 flex items-center justify-center">
            <Briefcase className="h-5 w-5 text-[#00AAFF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-0.5">Clients</h1>
            <p className="text-white/40 text-sm">
              Every client you have won or onboarded. Track delivery and ongoing work.
            </p>
          </div>
        </div>

        {/* Multi-client GHL aggregate — 7-day rollup across every connection */}
        {ghlAggregate && ghlAggregate.totalConnections > 0 && (
          <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/[0.05] rounded-xl p-5 mb-6">
            <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-3">
              This week across all clients
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-white font-bold text-2xl">{ghlAggregate.totalConversations}</p>
                <p className="text-white/40 text-xs mt-1">Conversations</p>
              </div>
              <div>
                <p className="text-white font-bold text-2xl">{ghlAggregate.totalReplies}</p>
                <p className="text-white/40 text-xs mt-1">Replies received</p>
              </div>
              <div>
                <p className="text-white font-bold text-2xl">{ghlAggregate.totalHotLeads}</p>
                <p className="text-white/40 text-xs mt-1">Hot leads</p>
              </div>
              <div>
                <p className="text-white font-bold text-2xl">
                  {Math.round(ghlAggregate.averageResponseRate)}%
                </p>
                <p className="text-white/40 text-xs mt-1">Avg response rate</p>
              </div>
            </div>
            <p className="text-white/30 text-xs mt-4">
              Across {ghlAggregate.totalConnections} connected{" "}
              {ghlAggregate.totalConnections === 1 ? "client" : "clients"}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="border border-white/10 bg-white/[0.03] rounded-xl p-4">
            <p className="text-white font-bold text-2xl">{counts.all}</p>
            <p className="text-white/40 text-xs mt-1">Total clients</p>
          </div>
          <div className="border border-green-500/20 bg-green-500/[0.05] rounded-xl p-4">
            <p className="text-green-400 font-bold text-2xl">{counts.won}</p>
            <p className="text-white/40 text-xs mt-1">Deals won</p>
          </div>
          <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/[0.05] rounded-xl p-4">
            <p className="text-[#00AAFF] font-bold text-2xl">{counts.onboarded}</p>
            <p className="text-white/40 text-xs mt-1">GHL onboarded</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-5">
          {(
            [
              { key: "all", label: "All clients" },
              { key: "won", label: "Won deals" },
              { key: "onboarded", label: "GHL onboarded" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filter === tab.key
                  ? "text-white border-[#00AAFF]"
                  : "text-white/40 border-transparent hover:text-white/70"
              }`}
            >
              {tab.label} <span className="text-white/30 ml-1">{counts[tab.key]}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-[#00AAFF]/40 outline-none"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-white/30">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="border border-white/10 rounded-xl p-12 text-center">
            <p className="text-white/40 text-sm mb-2">
              {clients.length === 0 ? "No clients yet" : "No clients match your filter"}
            </p>
            {clients.length === 0 && (
              <p className="text-white/30 text-xs">
                Clients appear here when you win a proposal or connect their GHL sub-account
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <div
                key={`${client.id}-${client.types.join(",")}`}
                className="border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-white font-semibold">{client.business || client.name}</p>
                      {client.types.includes("won") && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400">
                          Won
                        </span>
                      )}
                      {client.types.includes("onboarded") && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#00AAFF]/15 text-[#00AAFF]">
                          GHL Onboarded
                        </span>
                      )}
                    </div>
                    <p className="text-white/30 text-xs mb-3">
                      {client.niche}
                      {client.won_at && ` · Won ${formatDate(client.won_at)}`}
                      {client.onboarded_at && ` · Onboarded ${formatDate(client.onboarded_at)}`}
                    </p>

                    <div className="flex gap-2 flex-wrap">
                      {client.proposal_id && (
                        <Link
                          href={`/proposal/builder?id=${client.proposal_id}`}
                          className="text-xs bg-white/[0.05] text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10"
                        >
                          View proposal →
                        </Link>
                      )}
                      {client.ghl_connection_id && (
                        <Link
                          href={`/revival/account/${client.ghl_connection_id}`}
                          className="text-xs bg-[#00AAFF]/10 text-[#00AAFF] hover:bg-[#00AAFF]/20 px-3 py-1.5 rounded-lg border border-[#00AAFF]/20"
                        >
                          View GHL results →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
