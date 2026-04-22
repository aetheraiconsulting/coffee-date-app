/**
 * Shared pricing module — single source of truth for Dead Lead Revival
 * pricing models, labels, guarantees, and formatting.
 *
 * Before Phase 4F this logic was duplicated inline across:
 *   - /app/(app)/offer/builder/page.tsx (PRICING_MODELS, LOCKED_GUARANTEES, formatPricePoint)
 *   - /app/(app)/offer/my-offers/page.tsx (getPricingModelBadge)
 *   - /app/(app)/outreach/page.tsx (labels map)
 *
 * Everything below is the canonical definition. Do not re-define these
 * constants anywhere else in the app.
 */

export type PricingModel =
  | "50_profit_share"
  | "custom_profit_share"
  | "pay_per_lead"
  | "pay_per_conversation"
  | "retainer"

/** Human-readable label for each pricing model. Used in badges, dropdowns,
 *  and anywhere the model slug needs a display form. */
export const PRICING_MODELS: Record<PricingModel, string> = {
  "50_profit_share": "50% Profit Share",
  "custom_profit_share": "Custom Profit Share",
  "pay_per_lead": "Pay Per Lead",
  "pay_per_conversation": "Pay Per Conversation",
  "retainer": "Monthly Retainer",
}

/** One-sentence description of what the client pays under each model.
 *  Used in proposal UIs and sales scripts. */
export const PRICING_MODEL_DESCRIPTIONS: Record<PricingModel, string> = {
  "50_profit_share":
    "50% of net profit recovered from reactivated leads. Zero upfront cost. Zero retainer.",
  "custom_profit_share":
    "Custom percentage of net profit recovered. Negotiated per client.",
  "pay_per_lead": "Fixed fee per qualified lead generated.",
  "pay_per_conversation": "Fixed fee per conversation booked.",
  "retainer": "Monthly retainer fee for ongoing service.",
}

/** Guarantee shown alongside the price. Populates the `guarantee` field on
 *  offers when a pricing model is selected. */
export const LOCKED_GUARANTEES: Record<PricingModel, string> = {
  "50_profit_share":
    "Zero upfront. You only pay when we recover revenue you had written off.",
  "custom_profit_share": "Zero upfront. You only pay on performance.",
  "pay_per_lead": "You only pay for leads that match your qualification criteria.",
  "pay_per_conversation": "You only pay for conversations that actually happen.",
  "retainer": "Cancel any time with 30 days notice.",
}

/** Models where the operator only gets paid when they deliver a result.
 *  Used to drive the emerald "performance" badge vs the amber "retainer" badge. */
export const PERFORMANCE_MODELS: PricingModel[] = [
  "50_profit_share",
  "custom_profit_share",
  "pay_per_lead",
  "pay_per_conversation",
]

export function isPerformanceModel(model: string | null | undefined): boolean {
  if (!model) return false
  return PERFORMANCE_MODELS.includes(model as PricingModel)
}

/**
 * Formats the numeric `priceValue` into the canonical `price_point` string.
 * The offers table stores this formatted string (not a numeric column) so
 * keep this helper and `parsePricePoint` below in sync.
 */
export function formatPricePoint(
  model: PricingModel,
  priceValue?: string | number,
): string {
  const val = priceValue === undefined || priceValue === null ? "X" : String(priceValue)
  switch (model) {
    case "50_profit_share":
      return "50% of net profit recovered"
    case "custom_profit_share":
      return `${val || "X"}% of net profit recovered`
    case "pay_per_lead":
      return `$${val || "X"} per qualified lead`
    case "pay_per_conversation":
      return `$${val || "X"} per booked conversation`
    case "retainer":
      return `$${val || "X"}/month`
    default:
      return ""
  }
}

/**
 * Extracts the numeric value from a formatted `price_point` string.
 * Returns null if the string doesn't contain a number (shouldn't happen
 * for valid offers, but we guard anyway).
 *
 * Examples:
 *   "50% of net profit recovered"     -> 50
 *   "$25 per qualified lead"           -> 25
 *   "$2500/month"                      -> 2500
 */
export function parsePricePoint(pricePoint: string | null | undefined): number | null {
  if (!pricePoint) return null
  const match = pricePoint.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const n = parseFloat(match[0])
  return isNaN(n) ? null : n
}

/** Badge colour tokens for the pricing model. Performance models get the
 *  emerald accent to reward the "no-risk" narrative; retainer gets the
 *  neutral brand blue. */
export function getPricingModelBadgeColour(model: string | null | undefined): {
  bg: string
  text: string
  border: string
  tailwind: string
} {
  if (isPerformanceModel(model)) {
    return {
      bg: "rgba(16, 185, 129, 0.1)",
      text: "#10b981",
      border: "rgba(16, 185, 129, 0.3)",
      tailwind: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
    }
  }
  return {
    bg: "rgba(0, 170, 255, 0.1)",
    text: "#00AAFF",
    border: "rgba(0, 170, 255, 0.3)",
    tailwind: "bg-[#00AAFF]/10 text-[#00AAFF] border-[#00AAFF]/30",
  }
}

/** Convenience helper that returns both the badge styling and the display
 *  label for a given pricing model. Used by /offer/my-offers. */
export function getPricingModelBadge(model: string | null | undefined): {
  color: string
  label: string
} {
  const colour = getPricingModelBadgeColour(model)
  const label =
    model && (model as PricingModel) in PRICING_MODELS
      ? PRICING_MODELS[model as PricingModel]
      : model?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || "Unknown"
  return { color: colour.tailwind, label }
}

// ---------------------------------------------------------------------------
// Agent Library pricing — Phase 4G
//
// The `agents` table now carries nine pricing columns so every deployable
// agent has a concrete, defensible price the operator can quote with zero
// calculation. The helpers below format those columns into the strings we
// render on the agent cards, in the audit's "Deployable agent match" row,
// and anywhere else we surface agent pricing. All prices are USD — the
// numeric values stored in the DB represent dollar amounts (e.g. 500 → $500,
// 2000 → $2k). Column names keep the `setup_fee_min` / `_max` schema that
// migration 049 introduced; the currency is handled entirely in formatting.
// ---------------------------------------------------------------------------

/** Shape of the pricing-related columns on an `agents` row. Types allow
 *  `null` because older agents (pre-migration) may not have all fields set. */
export interface AgentPricing {
  default_pricing_model: string | null
  setup_fee_min: number | null
  setup_fee_max: number | null
  monthly_fee_min: number | null
  monthly_fee_max: number | null
  performance_fee_min: number | null
  performance_fee_max: number | null
  performance_fee_basis: string | null
  performance_notes: string | null
  pricing_notes: string | null
}

/** Display labels for the agent-level pricing model enum. These describe
 *  the SHAPE of the commercial deal, not the offer's price point. */
export const AGENT_PRICING_MODEL_LABELS: Record<string, string> = {
  performance_only: "Performance only",
  hybrid_performance: "Setup + performance",
  hybrid_retainer: "Setup + retainer",
  per_deliverable: "Per deliverable",
  retainer_only: "Monthly retainer",
}

/** Format a USD amount, compressing thousands to "k" once we're over 1000.
 *  Returns null for null/undefined input so callers can chain checks. */
function fmtUSD(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  if (n >= 1000) {
    const k = n / 1000
    // Keep one decimal only when we actually need it (1.5k, not 1.0k).
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`
  }
  return `$${n}`
}

/** Format a [min,max] USD range, collapsing to a single value when min===max
 *  or when only one bound is set. Uses a shared "k" suffix when both bounds
 *  are in the thousands (e.g. "$2-3k" instead of "$2k-$3k"). */
function fmtUSDRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min === null || min === undefined) return fmtUSD(max ?? null)
  if (max === null || max === undefined || max === min) return fmtUSD(min)
  if (min >= 1000 && max >= 1000) {
    const a = min / 1000
    const b = max / 1000
    const fmt = (v: number) => (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1))
    return `$${fmt(a)}-${fmt(b)}k`
  }
  return `${fmtUSD(min)}-${fmtUSD(max)}`
}

/** Format a percentage range. Used for performance-fee percentages. */
function fmtPercentRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  if (min === null || min === undefined) {
    return max === null || max === undefined ? null : `${max}%`
  }
  if (max === null || max === undefined || max === min) return `${min}%`
  return `${min}-${max}%`
}

/**
 * Returns the display bundle for an agent's pricing:
 *   - `modelLabel`  — short label matching the default_pricing_model enum
 *   - `primary`     — headline price line (setup, retainer, performance combined)
 *   - `notes`       — optional clarifier from the `performance_notes` column
 *
 * The shape of `primary` depends on the model:
 *   performance_only    -> "$500 setup · 15-30% of recovered profit"
 *   hybrid_performance  -> "$500 setup · $2k/mo · +10% uplift"
 *   hybrid_retainer     -> "$2k setup · $2-3k/mo"
 *   per_deliverable     -> "$150-300 per booking"
 *   retainer_only       -> "$500-1k/mo"
 */
export function formatAgentPricing(agent: AgentPricing): {
  modelLabel: string
  primary: string
  notes: string | null
} {
  const model = agent.default_pricing_model || ""
  const modelLabel = AGENT_PRICING_MODEL_LABELS[model] || "Custom pricing"

  const setup = fmtUSDRange(agent.setup_fee_min, agent.setup_fee_max)
  const monthly = fmtUSDRange(agent.monthly_fee_min, agent.monthly_fee_max)
  const basis = agent.performance_fee_basis?.trim() || ""

  // Performance fee is a percentage unless the agent's model is per-deliverable,
  // in which case the min/max represent a USD amount per unit delivered.
  const perfAsPercent =
    model === "performance_only" || model === "hybrid_performance"
  const perfUSD = fmtUSDRange(agent.performance_fee_min, agent.performance_fee_max)
  const perfPct = fmtPercentRange(agent.performance_fee_min, agent.performance_fee_max)

  let primary = ""

  switch (model) {
    case "performance_only": {
      const parts: string[] = []
      if (setup) parts.push(`${setup} setup`)
      if (perfPct) parts.push(`${perfPct}${basis ? ` ${basis}` : " performance fee"}`)
      primary = parts.join(" · ") || "Performance only"
      break
    }
    case "hybrid_performance": {
      const parts: string[] = []
      if (setup) parts.push(`${setup} setup`)
      if (monthly) parts.push(`${monthly}/mo`)
      if (perfPct) parts.push(`+${perfPct}${basis ? ` ${basis}` : ""}`)
      primary = parts.join(" · ")
      break
    }
    case "hybrid_retainer": {
      const parts: string[] = []
      if (setup) parts.push(`${setup} setup`)
      if (monthly) parts.push(`${monthly}/mo`)
      primary = parts.join(" · ")
      break
    }
    case "per_deliverable": {
      primary = perfUSD
        ? `${perfUSD}${basis ? ` ${basis}` : " per deliverable"}`
        : "Per deliverable"
      break
    }
    case "retainer_only": {
      primary = monthly ? `${monthly}/mo` : "Monthly retainer"
      break
    }
    default: {
      // Unknown / legacy model — join whatever fields are present.
      const parts: string[] = []
      if (setup) parts.push(`${setup} setup`)
      if (monthly) parts.push(`${monthly}/mo`)
      if (perfAsPercent && perfPct) parts.push(`${perfPct}${basis ? ` ${basis}` : ""}`)
      else if (perfUSD) parts.push(`${perfUSD}${basis ? ` ${basis}` : ""}`)
      primary = parts.join(" · ") || "Custom pricing"
    }
  }

  return { modelLabel, primary, notes: agent.performance_notes?.trim() || null }
}
