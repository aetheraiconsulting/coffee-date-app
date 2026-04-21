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
