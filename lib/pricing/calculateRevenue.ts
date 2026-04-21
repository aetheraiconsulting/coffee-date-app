/**
 * Shared recoverable-revenue calculator.
 *
 * Given a database size, AOV, dormant %, and reactivation rate, returns the
 * expected recoverable revenue for the client AND the operator's commission
 * cut where it can be computed deterministically (fee-per-lead and
 * fee-per-conversation models).
 *
 * Profit-share models cannot be computed exactly without knowing the
 * client's cost of goods / margin, so we return null for commission and
 * surface an explanatory note instead. Callers should display the note
 * verbatim next to the recoverable-revenue figure.
 */

export interface RevenueCalculationInput {
  databaseSize: number
  aov: number
  dormantPercentage: number
  reactivationRate: number
  pricingModel?: string | null
  /** Numeric value from the offer: % for profit-share, $ for per-lead /
   *  per-conversation / retainer. Optional — if absent we fall back to 50
   *  for the profit-share default. */
  commissionPercentage?: number | null
}

export interface RevenueCalculationResult {
  dormantLeads: number
  expectedReactivations: number
  recoverableRevenue: number
  /** Null when the model is profit-share (needs client margin to compute)
   *  or retainer (not a function of recovered revenue). */
  operatorCommission: number | null
  commissionBasis:
    | "net_profit"
    | "net_revenue"
    | "per_lead"
    | "per_conversation"
    | "retainer"
    | null
  /** Human-readable sentence explaining how the operator gets paid. Safe to
   *  render verbatim — does not contain HTML or markdown. */
  commissionNote: string
}

export function calculateRecoverableRevenue(
  input: RevenueCalculationInput,
): RevenueCalculationResult {
  const dormantLeads = Math.round(
    (input.databaseSize || 0) * ((input.dormantPercentage || 0) / 100),
  )
  const expectedReactivations = Math.round(
    dormantLeads * ((input.reactivationRate || 0) / 100),
  )
  const recoverableRevenue = expectedReactivations * (input.aov || 0)

  let operatorCommission: number | null = null
  let commissionBasis: RevenueCalculationResult["commissionBasis"] = null
  let commissionNote = "Gross recoverable revenue for the client"

  const model = input.pricingModel
  const pct = input.commissionPercentage

  if (model === "50_profit_share") {
    // 50% of NET PROFIT — we cannot compute without client margin. Offer a
    // planning range based on a 20-40% client margin assumption (industry
    // average for service businesses) so the operator has a rough anchor.
    operatorCommission = null
    commissionBasis = "net_profit"
    commissionNote =
      "Your share: 50% of net profit (typically 10-20% of recoverable revenue once the client's cost of fulfilment is deducted)"
  } else if (model === "custom_profit_share") {
    operatorCommission = null
    commissionBasis = "net_profit"
    const share = pct && pct > 0 ? pct : 50
    commissionNote = `Your share: ${share}% of net profit`
  } else if (model === "pay_per_lead") {
    const feePerLead = pct && pct > 0 ? pct : 0
    operatorCommission = expectedReactivations * feePerLead
    commissionBasis = "per_lead"
    commissionNote = feePerLead
      ? `Your share: $${feePerLead} × ${expectedReactivations.toLocaleString()} expected leads`
      : "Your share: fixed fee per qualified lead"
  } else if (model === "pay_per_conversation") {
    const feePerConv = pct && pct > 0 ? pct : 0
    operatorCommission = expectedReactivations * feePerConv
    commissionBasis = "per_conversation"
    commissionNote = feePerConv
      ? `Your share: $${feePerConv} × ${expectedReactivations.toLocaleString()} expected conversations`
      : "Your share: fixed fee per booked conversation"
  } else if (model === "retainer") {
    operatorCommission = null
    commissionBasis = "retainer"
    commissionNote = pct
      ? `Your share: $${pct.toLocaleString()} / month — not tied to recovered revenue`
      : "Your share: monthly retainer — not tied to recovered revenue"
  }

  return {
    dormantLeads,
    expectedReactivations,
    recoverableRevenue,
    operatorCommission,
    commissionBasis,
    commissionNote,
  }
}
