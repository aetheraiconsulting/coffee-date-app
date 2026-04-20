"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Search } from "lucide-react"

type ProposalRow = {
  id: string
  prospect_name: string | null
  prospect_business: string | null
  sent: boolean
  sent_at: string | null
  deal_status: "pending" | "won" | "lost" | null
  created_at: string
  offers?: { niche: string | null; service_name: string | null } | null
}

type FilterKey = "all" | "pending" | "won" | "lost"

export default function ProposalsListPage() {
  const supabase = createClient()
  const router = useRouter()
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    loadProposals()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProposals = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from("proposals")
      .select("id, prospect_name, prospect_business, sent, sent_at, deal_status, created_at, offers(niche, service_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setProposals((data as unknown as ProposalRow[]) || [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from("proposals").delete().eq("id", id)
    setProposals(proposals.filter((p) => p.id !== id))
    setDeleteConfirm(null)
  }

  const filteredProposals = proposals.filter((p) => {
    const status = p.deal_status ?? "pending"
    if (filter !== "all") {
      if (filter === "pending" && status !== "pending") return false
      if (filter === "won" && status !== "won") return false
      if (filter === "lost" && status !== "lost") return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        (p.prospect_name || "").toLowerCase().includes(q) ||
        (p.prospect_business || "").toLowerCase().includes(q) ||
        (p.offers?.niche || "").toLowerCase().includes(q)
      )
    }
    return true
  })

  const counts = {
    all: proposals.length,
    pending: proposals.filter((p) => (p.deal_status ?? "pending") === "pending").length,
    won: proposals.filter((p) => p.deal_status === "won").length,
    lost: proposals.filter((p) => p.deal_status === "lost").length,
  }

  const statusBadge = (status: ProposalRow["deal_status"], sent: boolean) => {
    if (!sent) return { label: "Draft", colour: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.04)" }
    if (status === "won") return { label: "Won", colour: "#22c55e", bg: "rgba(34,197,94,0.1)" }
    if (status === "lost") return { label: "Lost", colour: "#ef4444", bg: "rgba(239,68,68,0.1)" }
    return { label: "Pending", colour: "#f59e0b", bg: "rgba(245,158,11,0.1)" }
  }

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-5xl mx-auto py-8 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Proposals</h1>
            <p className="text-white/40 text-sm">
              Track every proposal you send — from draft to won.
            </p>
          </div>
          <button
            onClick={() => router.push("/proposal/builder?mode=new")}
            className="bg-[#00AAFF] text-black font-bold text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 hover:bg-[#00AAFF]/90 transition-colors"
          >
            <Plus size={16} /> New Proposal
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-white/10 mb-5 overflow-x-auto">
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "won", label: "Won" },
              { key: "lost", label: "Lost" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
            placeholder="Search by prospect, business, or niche..."
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-[#00AAFF]/40 outline-none placeholder:text-white/30"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-white/30 text-sm">Loading proposals...</div>
        ) : filteredProposals.length === 0 ? (
          <div className="border border-white/10 rounded-xl p-12 text-center bg-white/[0.02]">
            <p className="text-white/40 text-sm mb-2">
              {proposals.length === 0 ? "No proposals yet" : "No proposals match your filter"}
            </p>
            {proposals.length === 0 && (
              <button
                onClick={() => router.push("/proposal/builder?mode=new")}
                className="text-[#00AAFF] text-sm font-semibold hover:underline"
              >
                Build your first proposal →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProposals.map((p) => {
              const badge = statusBadge(p.deal_status, p.sent)
              return (
                <div
                  key={p.id}
                  className="border border-white/10 rounded-xl p-4 hover:border-white/20 hover:bg-white/[0.02] transition-colors cursor-pointer group bg-white/[0.015]"
                  onClick={() => router.push(`/proposal/builder?id=${p.id}`)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <p className="text-white font-semibold truncate">
                          {p.prospect_name || "Unnamed prospect"}
                          {p.prospect_business && (
                            <span className="text-white/40 font-normal"> — {p.prospect_business}</span>
                          )}
                        </p>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: badge.colour, background: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/30 flex-wrap">
                        <span>{p.offers?.niche || "No niche"}</span>
                        <span>·</span>
                        <span>
                          {p.sent && p.sent_at
                            ? `Sent ${new Date(p.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                            : `Created ${new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirm(p.id)
                      }}
                      className="text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                      aria-label="Delete proposal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-[#0F1318] border border-white/10 rounded-xl p-6 max-w-md w-full">
              <p className="text-white font-semibold mb-2">Delete this proposal?</p>
              <p className="text-white/50 text-sm mb-6">
                This cannot be undone. The proposal and all its data will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-white/[0.05] text-white/70 font-semibold text-sm py-3 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 font-semibold text-sm py-3 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
