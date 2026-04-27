// Shared pricing module — single source of truth for pricing models, labels,
// guarantees, and agent-pricing formatting. Build A scope only; downstream
// pages (Offer Builder, My Offers, Outreach, Opportunities) will be migrated
// to consume this in a future build.

export type PricingModel =
  | "50_profit_share"
  | "custom_profit_share"
  | "pay_per_lead"
  | "pay_per_conversation"
  | "retainer"

export const PRICING_MODELS: Record<PricingModel, string> = {
  "50_profit_share": "50% Profit Share",
  custom_profit_share: "Custom Profit Share",
  pay_per_lead: "Pay Per Lead",
  pay_per_conversation: "Pay Per Conversation",
  retainer: "Monthly Retainer",
}

export const PRICING_MODEL_DESCRIPTIONS: Record<PricingModel, string> = {
  "50_profit_share":
    "50% of net profit recovered from reactivated leads. Zero upfront cost. Zero retainer.",
  custom_profit_share: "Custom percentage of net profit recovered. Negotiated per client.",
  pay_per_lead: "Fixed fee per qualified lead generated.",
  pay_per_conversation: "Fixed fee per conversation booked.",
  retainer: "Monthly retainer fee for ongoing service.",
}

export const LOCKED_GUARANTEES: Record<PricingModel, string> = {
  "50_profit_share":
    "Zero upfront. You only pay when we recover revenue you had written off.",
  custom_profit_share: "Zero upfront. You only pay on performance.",
  pay_per_lead: "You only pay for leads that match your qualification criteria.",
  pay_per_conversation: "You only pay for conversations that actually happen.",
  retainer: "Cancel any time with 30 days notice.",
}

export const PERFORMANCE_MODELS: PricingModel[] = [
  "50_profit_share",
  "custom_profit_share",
  "pay_per_lead",
  "pay_per_conversation",
]

export function isPerformanceModel(model: PricingModel): boolean {
  return PERFORMANCE_MODELS.includes(model)
}

export function formatPricePoint(model: PricingModel, priceValue?: string): string {
  switch (model) {
    case "50_profit_share":
      return "50% of net profit recovered"
    case "custom_profit_share":
      return `${priceValue || "X"}% of net profit recovered`
    case "pay_per_lead":
      return `$${priceValue || "X"} per qualified lead`
    case "pay_per_conversation":
      return `$${priceValue || "X"} per booked conversation`
    case "retainer":
      return `$${priceValue || "X"}/month`
    default:
      return ""
  }
}

export function parsePricePoint(pricePoint: string | null | undefined): string | null {
  if (!pricePoint) return null
  const match = pricePoint.match(/(\d+(?:\.\d+)?)/)
  return match ? match[1] : null
}

export function getPricingModelBadgeColour(model: PricingModel): {
  bg: string
  text: string
  border: string
} {
  if (isPerformanceModel(model)) {
    return {
      bg: "rgba(16, 185, 129, 0.1)",
      text: "#10b981",
      border: "rgba(16, 185, 129, 0.3)",
    }
  }
  return {
    bg: "rgba(0, 170, 255, 0.1)",
    text: "#00AAFF",
    border: "rgba(0, 170, 255, 0.3)",
  }
}

export function getPricingModelBadge(model: PricingModel): {
  color: string
  label: string
} {
  const colours = getPricingModelBadgeColour(model)
  return {
    color: colours.text,
    label: PRICING_MODELS[model] || "Unknown",
  }
}

export interface AgentPricing {
  default_pricing_model: string | null
  typical_setup_fee_low: number | null
  typical_setup_fee_high: number | null
  typical_monthly_fee_low: number | null
  typical_monthly_fee_high: number | null
  typical_performance_fee: number | null
  performance_fee_basis: string | null
  performance_notes: string | null
  pricing_notes: string | null
}

export const PERFORMANCE_BASIS_LABELS: Record<string, string> = {
  net_profit_percentage: "of net profit",
  per_lead: "per qualified lead",
  per_conversation: "per booked conversation",
  per_booking: "per booking",
}

function fmtUSD(n: number): string {
  if (n === 0) return "$0"
  if (n >= 1000) {
    const k = n / 1000
    return k % 1 === 0 ? `$${k}k` : `$${k.toFixed(1)}k`
  }
  return `$${n}`
}

function fmtUSDRange(low: number | null, high: number | null): string {
  if (low === null || high === null) return ""
  if (low === high) return fmtUSD(low)
  if (low === 0) return fmtUSD(high)

  // Compress if both >= 1000 with same suffix
  if (low >= 1000 && high >= 1000) {
    const lowK = low / 1000
    const highK = high / 1000
    if (lowK % 1 === 0 && highK % 1 === 0) {
      return `$${lowK}-${highK}k`
    }
  }

  return `${fmtUSD(low)}-${fmtUSD(high)}`
}

export function formatAgentPricing(agent: AgentPricing): {
  modelLabel: string
  primary: string
  notes: string | null
} | null {
  const model = agent.default_pricing_model
  if (!model) return null

  const setupRange = fmtUSDRange(agent.typical_setup_fee_low, agent.typical_setup_fee_high)
  const monthlyRange = fmtUSDRange(agent.typical_monthly_fee_low, agent.typical_monthly_fee_high)
  const perfFee = agent.typical_performance_fee
  const basisLabel = agent.performance_fee_basis
    ? PERFORMANCE_BASIS_LABELS[agent.performance_fee_basis] || ""
    : ""

  let modelLabel = ""
  let primary = ""

  if (model === "50_profit_share") {
    modelLabel = "Performance"
    primary = `${perfFee}% of net profit`
  } else if (model === "custom_profit_share") {
    modelLabel = "Custom Performance"
    primary = `${perfFee}% ${basisLabel}`
  } else if (model === "retainer") {
    modelLabel = "Retainer"
    if (setupRange && monthlyRange) {
      primary = `${setupRange} setup · ${monthlyRange}/mo`
    } else if (monthlyRange) {
      primary = `${monthlyRange}/mo`
    } else {
      primary = "Custom retainer"
    }
  } else if (model === "pay_per_lead") {
    modelLabel = "Per Lead"
    primary = perfFee ? `$${perfFee} per lead` : "Custom per-lead pricing"
  } else if (model === "pay_per_conversation") {
    modelLabel = "Per Conversation"
    primary = perfFee ? `$${perfFee} per conversation` : "Custom per-conversation pricing"
  }

  return {
    modelLabel,
    primary,
    notes: agent.performance_notes || agent.pricing_notes || null,
  }
}
