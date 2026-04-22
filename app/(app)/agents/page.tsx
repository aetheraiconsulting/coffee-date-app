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
  Users,
  Wrench,
  X,
} from "lucide-react"
// Phase 4G — agent cards now render the concrete operator pricing for every
// deployable agent. The formatter is shared with the audit builder so both
// surfaces quote identical numbers.
import { formatAgentPricing, type AgentPricing } from "@/lib/pricing"
// Phase 4H — deploy flow forks into "self-deploy" (opens prompt generator in
// production mode) or "request Aether Team help" (opens the support request
// modal with agent_deployment context).
import {
  SupportRequestModal,
  type SupportRequestContext,
} from "@/components/support-request-modal"

// Map the icon name stored on each seeded agent row to an actual lucide icon
// component so we can render the right glyph inside the card header.
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

// Extends AgentPricing so we can pass the row straight to formatAgentPricing()
// without re-packing. The non-pricing fields are the ones we already render
// in the card header and grid below.
interface AgentRow extends AgentPricing {
  id: string
  slug: string
  name: string
  category: string
  icon: string | null
  problem_solved: string
  one_liner: string
  description: string
  typical_roi: string | null
  setup_time_estimate: string | null
  is_public: boolean
  sort_order: number | null
  // Phase 4H — shown inside the deploy modal so operators can see at a
  // glance how much work a deployment is before deciding self-deploy vs
  // Aether Team help.
  complexity_level: string | null
  typical_deployment_hours: number | null
}

export default function AgentsLibraryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  useEffect(() => {
    const loadAgents = async () => {
      const { data } = await supabase
        .from("agents")
        .select(
          // Pricing columns match the live schema (typical_setup_fee_low/high,
          // typical_monthly_fee_low/high, typical_performance_fee). The
          // formatter in lib/pricing reads these directly.
          "id, slug, name, category, icon, problem_solved, one_liner, description, typical_roi, setup_time_estimate, is_public, sort_order, default_pricing_model, typical_setup_fee_low, typical_setup_fee_high, typical_monthly_fee_low, typical_monthly_fee_high, typical_performance_fee, performance_fee_basis, performance_notes, pricing_notes, complexity_level, typical_deployment_hours",
        )
        .eq("is_public", true)
        .order("sort_order", { ascending: true })

      setAgents((data as AgentRow[]) || [])
      setLoading(false)
    }
    loadAgents()
  }, [supabase])

  // Build a unique, stable category list from the current rows. Using a Set
  // keeps order based on first appearance which matches `sort_order` from SQL.
  const categories = Array.from(new Set(agents.map((a) => a.category).filter(Boolean)))

  const filteredAgents = agents.filter((a) => {
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        a.name.toLowerCase().includes(q) ||
        (a.problem_solved || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q)
      )
    }
    return true
  })

  // Phase 4H — split the legacy "Build this agent" CTA into two distinct
  // actions. The Coffee Date Demo flow (used in sales conversations with
  // prospects) is now explicitly labeled "Build sales demo", while
  // production deployment opens a modal forcing the operator to choose
  // between self-deploy and Aether Team delivery.
  const [deployingAgent, setDeployingAgent] = useState<AgentRow | null>(null)
  const [supportContext, setSupportContext] = useState<SupportRequestContext | null>(
    null,
  )
  const [supportOpen, setSupportOpen] = useState(false)

  // Secondary action on each card: launches the sales demo builder so the
  // operator can show prospects a Coffee Date Demo of the agent in action.
  const handleBuildDemo = (agent: AgentRow) => {
    const params = new URLSearchParams({
      agent_slug: agent.slug,
      agent_name: agent.name,
    })
    router.push(`/prompt-generator?${params.toString()}`)
  }

  // Primary action on each card: opens the deploy modal instead of
  // navigating directly, so the user can decide how they want to deploy.
  const handleDeployAgent = (agent: AgentRow) => {
    setDeployingAgent(agent)
  }

  // Self-deploy path inside the deploy modal — routes the operator to
  // the prompt generator with mode=production so that downstream code
  // can tailor copy/notes for a real client deployment rather than a
  // sales demo.
  const handleSelfDeploy = (agent: AgentRow) => {
    const params = new URLSearchParams({
      agent_slug: agent.slug,
      agent_name: agent.name,
      mode: "production",
    })
    router.push(`/prompt-generator?${params.toString()}`)
    setDeployingAgent(null)
  }

  // Aether Team help path — opens the support request modal pre-filled
  // with agent context so the notification email gives Adam/Anjal the
  // agent name, slug, complexity, and deployment hours without needing
  // to ping the operator for details.
  const handleRequestAetherHelp = (agent: AgentRow) => {
    setSupportContext({
      request_type: "agent_deployment",
      agent_id: agent.id,
      agent_name: agent.name,
      agent_slug: agent.slug,
    })
    setSupportOpen(true)
    setDeployingAgent(null)
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Agent Library</h1>
        <p className="text-white/40 text-sm">
          Deployable AI agents built for specific business problems. Pick one, build the Android, deploy for your client.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 border-b border-white/10 mb-5 overflow-x-auto">
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
          className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:border-[#00AAFF]/40 outline-none"
        />
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="text-center py-12 text-white/30">Loading agents...</div>
      ) : filteredAgents.length === 0 ? (
        <div className="border border-white/10 rounded-xl p-12 text-center">
          <p className="text-white/40 text-sm">No agents match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAgents.map((agent) => {
            const Icon = iconMap[agent.icon || ""] || Bot
            // Pre-compute pricing display so we can conditionally render the
            // pricing block without calling the formatter twice inside JSX.
            const pricing = formatAgentPricing(agent)
            const hasPricing = Boolean(agent.default_pricing_model)
            return (
              <div
                key={agent.id}
                className="border border-white/10 rounded-xl p-5 hover:border-[#00AAFF]/30 transition-colors flex flex-col"
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
                <p className="text-white/50 text-sm mb-4 leading-relaxed flex-1">
                  {agent.one_liner}
                </p>

                {/* Pricing block — prominent so operators can quote the deal
                    without clicking in. Emerald-tinted to reinforce that
                    these are concrete operator earnings numbers. */}
                {hasPricing && (
                  <div className="border border-emerald-400/20 bg-emerald-400/[0.05] rounded-lg px-3 py-2.5 mb-4">
                    <p className="text-emerald-400/70 text-[10px] font-semibold uppercase tracking-wider mb-1">
                      {pricing.modelLabel}
                    </p>
                    <p className="text-white font-bold text-sm leading-tight">
                      {pricing.primary}
                    </p>
                    {pricing.notes && (
                      <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                        {pricing.notes}
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-white/5 pt-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-white/30 mb-0.5">Typical ROI</p>
                      <p className="text-[#00AAFF] font-bold">{agent.typical_roi || "—"}</p>
                    </div>
                    <div>
                      <p className="text-white/30 mb-0.5">Setup time</p>
                      <p className="text-white/70 font-semibold">{agent.setup_time_estimate || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Phase 4H — split button pattern. Helper copy sits above
                    so operators always know the difference between a
                    production deployment and a sales-demo Android. */}
                <div>
                  {/* No extra border-t here — the grid above already
                      carries the divider via `border-t ... mb-4`. */}
                  <p className="text-white/30 text-xs mb-3 leading-relaxed">
                    <span className="text-white/70 font-semibold">Deploy</span> = production agent for your client.
                    <br />
                    <span className="text-white/70 font-semibold">Sales demo</span> = AI that pitches this agent to prospects.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleDeployAgent(agent)}
                      className="w-full bg-[#00AAFF] text-black font-bold text-sm py-2.5 rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
                    >
                      Deploy this agent →
                    </button>
                    <button
                      onClick={() => handleBuildDemo(agent)}
                      className="w-full bg-white/5 border border-white/10 text-white/80 font-semibold text-sm py-2.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
                    >
                      Build sales demo →
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Phase 4H — deploy modal. Renders as an overlay when an agent is
          selected for deployment. It offers two mutually exclusive paths
          so the operator has to explicitly choose how they want to ship
          this to their client, and gives them the rough effort estimate
          up front so the decision is informed. */}
      {deployingAgent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-6 overflow-y-auto">
          <div className="bg-[#0F1318] border border-white/10 rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-1">
                  Deploy {deployingAgent.name}
                </p>
                <p className="text-white font-bold text-lg leading-snug">
                  How do you want to deploy this?
                </p>
              </div>
              <button
                onClick={() => setDeployingAgent(null)}
                className="text-white/30 hover:text-white/60 flex-shrink-0"
                aria-label="Close deploy modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(deployingAgent.complexity_level ||
              deployingAgent.typical_deployment_hours) && (
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                {deployingAgent.complexity_level && (
                  <>
                    This is a{" "}
                    <span className="text-white/80 font-semibold">
                      {deployingAgent.complexity_level}
                    </span>{" "}
                    agent
                  </>
                )}
                {deployingAgent.typical_deployment_hours && (
                  <>
                    {deployingAgent.complexity_level ? " — " : ""}
                    typical deployment takes{" "}
                    <span className="text-white/80 font-semibold">
                      {deployingAgent.typical_deployment_hours} hours
                    </span>
                    .
                  </>
                )}
              </p>
            )}

            {/* Option 1 — self-deploy */}
            <div className="border border-white/10 rounded-xl p-5 mb-4 hover:border-[#00AAFF]/30 transition-colors">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-white/5 rounded-lg p-2 flex-shrink-0">
                  <Wrench className="h-4 w-4 text-white/70" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold mb-1">Deploy it yourself</p>
                  <p className="text-white/50 text-sm leading-relaxed">
                    You have the technical capability to integrate this agent
                    into your client&apos;s GHL sub-account, connect the
                    workflows, and configure the AI. We&apos;ll provide the
                    Android prompt template and deployment notes.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSelfDeploy(deployingAgent)}
                className="w-full bg-white/5 border border-white/10 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Self-deploy →
              </button>
            </div>

            {/* Option 2 — Aether Team help (recommended) */}
            <div className="border border-[#00AAFF]/30 bg-[#00AAFF]/5 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-[#00AAFF]/15 rounded-lg p-2 flex-shrink-0">
                  <Users className="h-4 w-4 text-[#00AAFF]" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold mb-1 flex items-center gap-2 flex-wrap">
                    Get Aether Team help
                    <span className="text-[#00AAFF] text-xs font-bold bg-[#00AAFF]/15 px-2 py-0.5 rounded-full">
                      RECOMMENDED
                    </span>
                  </p>
                  <p className="text-white/70 text-sm leading-relaxed mb-3">
                    Our CTO Anjal and team deploy the agent for your client. You
                    focus on closing deals, we handle delivery.
                  </p>
                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-xs text-white/50 leading-relaxed">
                    <p className="font-semibold text-white/70 mb-1">
                      Revenue share model:
                    </p>
                    <p>
                      <span className="text-white/80 font-semibold">10%</span> —
                      guidance only (we advise, you build)
                    </p>
                    <p>
                      <span className="text-white/80 font-semibold">30%</span> —
                      delivery assistance (we do the hard parts)
                    </p>
                    <p>
                      <span className="text-white/80 font-semibold">50%</span> —
                      full delivery (we build and deliver)
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRequestAetherHelp(deployingAgent)}
                className="w-full bg-[#00AAFF] text-black font-bold text-sm py-2.5 rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
              >
                Request Aether Team help →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 4H — support request modal. Mounted here so both the
          "Get Aether Team help" path above and any future Agent Library
          triggers can open it without a separate wrapper component. */}
      <SupportRequestModal
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        initialContext={supportContext}
      />
    </div>
  )
}
