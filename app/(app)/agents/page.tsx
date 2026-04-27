"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  Search,
  Zap,
  MessageSquare,
  Calendar,
  Star,
  FileText,
  Target,
  CalendarCheck,
  Headphones,
  Bot,
} from "lucide-react"
import { formatAgentPricing, type AgentPricing } from "@/lib/pricing"

// Map of icon-name strings stored on the agent row to lucide-react components.
// Falls back to <Bot/> when the row points at an icon we don't ship.
const iconMap: Record<string, any> = {
  Zap,
  MessageSquare,
  Calendar,
  Star,
  FileText,
  Target,
  CalendarCheck,
  Headphones,
  Bot,
}

interface AgentRow extends AgentPricing {
  id: string
  slug: string
  name: string
  category: string
  problem_solved: string
  one_liner: string
  description: string
  typical_roi: string
  setup_time_estimate: string
  icon: string
  fit_niches: string[]
}

export default function AgentsLibraryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  useEffect(() => {
    loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAgents = async () => {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("is_public", true)
      .order("sort_order", { ascending: true })

    setAgents(data || [])
    setLoading(false)
  }

  // Build the unique category list from whatever rows we have. Order is
  // preserved as-encountered which mirrors `sort_order` from the query.
  const categories = Array.from(new Set(agents.map((a) => a.category)))

  const filteredAgents = agents.filter((a) => {
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        a.name.toLowerCase().includes(q) ||
        a.problem_solved.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      )
    }
    return true
  })

  const handleBuildAgent = (agent: AgentRow) => {
    const params = new URLSearchParams({
      agent_slug: agent.slug,
      agent_name: agent.name,
    })
    router.push(`/prompt-generator?${params.toString()}`)
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Agent Library</h1>
        <p className="text-white/40 text-sm">
          Deployable AI agents built for specific business problems. Each agent shows its typical pricing and ROI.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 border-b border-white/[0.08] mb-5 overflow-x-auto">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            categoryFilter === "all"
              ? "text-white border-[#00AAFF]"
              : "text-white/40 border-transparent hover:text-white/70"
          }`}
        >
          All Agents <span className="text-white/30 ml-1">{agents.length}</span>
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              categoryFilter === cat
                ? "text-white border-[#00AAFF]"
                : "text-white/40 border-transparent hover:text-white/70"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents by problem or capability..."
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-[#00AAFF]/40 outline-none"
        />
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="text-center py-12 text-white/30">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAgents.map((agent) => {
            const Icon = iconMap[agent.icon] || Bot
            const pricing = formatAgentPricing(agent)

            return (
              <div
                key={agent.id}
                className="border border-white/[0.08] rounded-xl p-5 hover:border-[#00AAFF]/30 transition-colors"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="bg-[#00AAFF]/10 border border-[#00AAFF]/20 rounded-lg p-2.5 flex-shrink-0">
                    <Icon size={18} className="text-[#00AAFF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold mb-0.5">{agent.name}</p>
                    <p className="text-white/40 text-xs">{agent.category}</p>
                  </div>
                </div>

                <p className="text-white/70 text-sm font-semibold mb-1.5">
                  Solves: {agent.problem_solved}
                </p>
                <p className="text-white/50 text-sm mb-4 leading-relaxed">{agent.one_liner}</p>

                {pricing && (
                  <div className="border-t border-white/[0.05] pt-4 mb-4">
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-1">
                      {pricing.modelLabel}
                    </p>
                    <p className="text-emerald-400 font-bold text-sm">{pricing.primary}</p>
                    {pricing.notes && (
                      <p className="text-white/30 text-xs mt-2 leading-relaxed">{pricing.notes}</p>
                    )}
                  </div>
                )}

                <div className="border-t border-white/[0.05] pt-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-white/30 mb-0.5">Typical ROI</p>
                      <p className="text-[#00AAFF] font-bold">{agent.typical_roi}</p>
                    </div>
                    <div>
                      <p className="text-white/30 mb-0.5">Setup time</p>
                      <p className="text-white/70 font-semibold">{agent.setup_time_estimate}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleBuildAgent(agent)}
                  className="w-full bg-[#00AAFF] text-black font-bold text-sm py-2.5 rounded-lg hover:bg-[#00AAFF]/90 min-h-[44px]"
                >
                  Build this agent →
                </button>
              </div>
            )
          })}
        </div>
      )}

      {filteredAgents.length === 0 && !loading && (
        <div className="border border-white/[0.08] rounded-xl p-12 text-center">
          <p className="text-white/40 text-sm">No agents match your search</p>
        </div>
      )}
    </div>
  )
}
