"use client"

// ---------------------------------------------------------------------------
// Phase 4G.2 — Admin page to trigger agent pricing research
//
// Visible only to Adam's email addresses. Surfaces the current pricing on
// every public agent and lets an admin fire the /api/agents/research-pricing
// endpoint. Dead Lead Revival shows a lock icon because the API will always
// re-apply its fixed pricing regardless of Claude output.
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { RefreshCw, CheckCircle, XCircle, Lock } from "lucide-react"
import { formatAgentPricing, type AgentPricing } from "@/lib/pricing"

// Must match the allowlist in /api/agents/research-pricing/route.ts. We
// check both places so the UI hides the run button from non-admins.
const ADMIN_EMAILS = [
  "adam@aetherai.consulting",
  "adam.stacey@yahoomail.co.uk",
  "adam@americanbrit.com",
]

interface AgentRow extends AgentPricing {
  id: string
  slug: string
  name: string
  category: string | null
  sort_order: number | null
}

interface ResearchResult {
  slug: string
  name: string
  status: string
  pricing?: Record<string, unknown> | null
  error?: string
}

interface ResearchResponse {
  processed?: number
  succeeded?: number
  failed?: number
  results?: ResearchResult[]
  error?: string
}

export default function AgentPricingAdminPage() {
  const supabase = createClient()
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ResearchResponse | null>(null)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

  // `loadAgents` is reused after a research run finishes, so memoise it
  // with the supabase client dep to keep the reference stable.
  const loadAgents = useCallback(async () => {
    const { data } = await supabase
      .from("agents")
      .select(
        "id, slug, name, category, sort_order, default_pricing_model, typical_setup_fee_low, typical_setup_fee_high, typical_monthly_fee_low, typical_monthly_fee_high, typical_performance_fee, performance_fee_basis, performance_notes, pricing_notes",
      )
      .eq("is_public", true)
      .order("sort_order", { ascending: true })

    setAgents((data as AgentRow[]) || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setChecked(true)
        return
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle()

      const email = profile?.email?.toLowerCase() || ""
      if (email && ADMIN_EMAILS.includes(email)) setIsAdmin(true)
      setChecked(true)
    }
    checkAccess()
    loadAgents()
  }, [supabase, loadAgents])

  const handleResearch = async () => {
    setRunning(true)
    setResults(null)
    try {
      const response = await fetch("/api/agents/research-pricing", {
        method: "POST",
      })
      const data = (await response.json()) as ResearchResponse
      setResults(data)
      await loadAgents()
    } catch (error: unknown) {
      setResults({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setRunning(false)
    }
  }

  // Pricing is considered "set" if we have a model AND at least one
  // monetary field. Used to drive the status icon on each row.
  const hasPricing = (agent: AgentRow) =>
    Boolean(agent.default_pricing_model) &&
    (agent.typical_setup_fee_low != null ||
      agent.typical_monthly_fee_low != null ||
      agent.typical_performance_fee != null)

  if (!checked) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-6 text-white/40">Loading...</div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-6">
        <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-6">
          <p className="text-red-400 font-bold mb-2">Admin access required</p>
          <p className="text-red-300/60 text-sm">
            This page is restricted to Aether team members.
          </p>
        </div>
      </div>
    )
  }

  const nonDlrCount = agents.filter((a) => a.slug !== "dead-lead-revival").length

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          Agent Pricing Research
        </h1>
        <p className="text-white/40 text-sm leading-relaxed">
          Have Claude research 2026 US market benchmarks for all agent pricing.
          Dead Lead Revival is locked at 50% net profit. All other agents
          receive researched USD pricing.
        </p>
      </div>

      {/* Run-research CTA */}
      <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/5 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-white font-semibold mb-1">
              Research pricing for all agents
            </p>
            <p className="text-white/50 text-sm leading-relaxed">
              Claude will be called once per non-locked agent ({nonDlrCount}{" "}
              {nonDlrCount === 1 ? "call" : "calls"}). Takes roughly 30-60
              seconds.
            </p>
          </div>
          <button
            onClick={handleResearch}
            disabled={running}
            className="bg-[#00AAFF] text-black font-bold px-5 py-2.5 rounded-lg whitespace-nowrap disabled:opacity-50 flex items-center gap-2 hover:bg-[#00AAFF]/90 transition-colors"
          >
            {running ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                Run research
              </>
            )}
          </button>
        </div>
      </div>

      {/* Current pricing status per agent */}
      <div className="mb-6">
        <h2 className="text-white font-semibold mb-3">Current agent pricing</h2>
        {loading ? (
          <p className="text-white/30">Loading agents...</p>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => {
              const priced = hasPricing(agent)
              const formatted = priced
                ? formatAgentPricing(agent)
                : null
              return (
                <div
                  key={agent.id}
                  className="border border-white/10 rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {agent.slug === "dead-lead-revival" ? (
                      <Lock
                        size={14}
                        className="text-amber-400 flex-shrink-0"
                        aria-label="Locked pricing"
                      />
                    ) : priced ? (
                      <CheckCircle
                        size={14}
                        className="text-emerald-400 flex-shrink-0"
                        aria-label="Pricing set"
                      />
                    ) : (
                      <XCircle
                        size={14}
                        className="text-red-400 flex-shrink-0"
                        aria-label="No pricing"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {agent.name}
                      </p>
                      <p className="text-white/40 text-xs truncate">
                        {agent.slug === "dead-lead-revival"
                          ? "Locked: 50% net profit share"
                          : formatted
                            ? `${formatted.modelLabel} · ${formatted.primary}`
                            : "No pricing set — run research"}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Last-run results */}
      {results && (
        <div className="border border-white/10 rounded-xl p-5">
          <p className="text-white font-semibold mb-3">Last run results</p>
          {results.error ? (
            <p className="text-red-400 text-sm">{results.error}</p>
          ) : (
            <>
              <div className="flex gap-4 mb-4 text-sm flex-wrap">
                <span className="text-white/60">
                  Processed:{" "}
                  <span className="text-white font-bold">{results.processed}</span>
                </span>
                <span className="text-emerald-400">
                  Succeeded:{" "}
                  <span className="font-bold">{results.succeeded}</span>
                </span>
                <span className="text-red-400">
                  Failed: <span className="font-bold">{results.failed}</span>
                </span>
              </div>
              <details>
                <summary className="text-[#00AAFF] text-sm cursor-pointer hover:underline">
                  View detailed results
                </summary>
                <pre className="mt-3 text-white/60 text-xs overflow-auto bg-black/30 rounded-lg p-3 max-h-96">
                  {JSON.stringify(results.results, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}
