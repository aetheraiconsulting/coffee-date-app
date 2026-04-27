// Shared revenue calculator — used by Opportunities, Offer Builder, and any
// other surface that estimates recoverable revenue and operator commission
// from a database size + AOV + dormant percentage + reactivation rate.
// Build A only creates the helper; downstream pages will be migrated to
// consume it in a future build.

export interface RevenueCalculationInput {
  databaseSize: number
  aov: number
  dormantPercentage: number
  reactivationRate: number
  pricingModel?: string
  commissionPercentage?: number
}

export interface RevenueCalculationResult {
  dormantLeads: number
  expectedReactivations: number
  recoverableRevenue: number
  operatorCommission: number | null
  commissionBasis: "net_profit" | "net_revenue" | "per_lead" | "per_conversation" | null
  commissionNote: string
}

export function calculateRecoverableRevenue(
  input: RevenueCalculationInput,
): RevenueCalculationResult {
  const dormantLeads = Math.round(input.databaseSize * (input.dormantPercentage / 100))
  const expectedReactivations = Math.round(dormantLeads * (input.reactivationRate / 100))
  const recoverableRevenue = expectedReactivations * input.aov

  let operatorCommission: number | null = null
  let commissionBasis: RevenueCalculationResult["commissionBasis"] = null
  let commissionNote = "Gross recoverable revenue for the client"

  if (input.pricingModel === "50_profit_share") {
    operatorCommission = null
    commissionBasis = "net_profit"
    commissionNote =
      "Your share: 50% of net profit (typically 10-20% of recoverable revenue depending on client margin)"
  } else if (input.pricingModel === "custom_profit_share" && input.commissionPercentage) {
    operatorCommission = null
    commissionBasis = "net_profit"
    commissionNote = `Your share: ${input.commissionPercentage}% of net profit`
  } else if (input.pricingModel === "pay_per_lead") {
    const feePerLead = input.commissionPercentage || 0
    operatorCommission = expectedReactivations * feePerLead
    commissionBasis = "per_lead"
    commissionNote = `Your share: $${feePerLead} × ${expectedReactivations} expected leads`
  } else if (input.pricingModel === "pay_per_conversation") {
    const feePerConv = input.commissionPercentage || 0
    operatorCommission = expectedReactivations * feePerConv
    commissionBasis = "per_conversation"
    commissionNote = `Your share: $${feePerConv} × ${expectedReactivations} expected conversations`
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
