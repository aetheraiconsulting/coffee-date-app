import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// Phase 4G.2 — Agent pricing research endpoint
//
// Admin-only endpoint that walks every public agent and either:
//   - Locks pricing for `dead-lead-revival` at the fixed values Adam never
//     changes ($0 setup, $0 monthly, 50% of net profit), or
//   - Asks Claude for realistic 2026 US market benchmarks and persists the
//     returned pricing onto the agent row.
//
// Stored in the five existing Phase 4E pricing columns:
//   typical_setup_fee_low / _high  (int USD)
//   typical_monthly_fee_low / _high (int USD)
//   typical_performance_fee         (int — % for profit share, $ per unit otherwise)
// plus the four descriptive columns added in migration 049:
//   default_pricing_model, performance_fee_basis,
//   performance_notes, pricing_notes
//
// Access is gated on the operator's email matching one of Adam's addresses.
// There is no feature-flag / plan gate here because this is a team-only tool.
// ---------------------------------------------------------------------------

// Single source of truth for who can trigger pricing research. Keep in sync
// with /app/(app)/admin/agent-pricing/page.tsx.
const ADMIN_EMAILS = [
  "adam@aetherai.consulting",
  "adam.stacey@yahoomail.co.uk",
  "adam@americanbrit.com",
]

interface ClaudePricing {
  default_pricing_model: string
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

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Admin email allowlist. We look the email up from `profiles` because
  // user.email can be null on some auth flows.
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle()

  const email = profile?.email?.toLowerCase() || ""
  if (!email || !ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 },
    )
  }

  const { data: agents } = await supabase
    .from("agents")
    .select("id, slug, name, category, problem_solved, one_liner, description")
    .eq("is_public", true)
    .order("sort_order", { ascending: true })

  if (!agents || agents.length === 0) {
    return NextResponse.json({ error: "No agents found" }, { status: 404 })
  }

  const results: Array<{
    slug: string
    name: string
    status: string
    pricing?: ClaudePricing | null
    error?: string
  }> = []

  for (const agent of agents) {
    // Dead Lead Revival is always locked at the fixed product pricing —
    // we don't let Claude second-guess this. Re-running is idempotent.
    if (agent.slug === "dead-lead-revival") {
      const { error } = await supabase
        .from("agents")
        .update({
          default_pricing_model: "50_profit_share",
          typical_setup_fee_low: 0,
          typical_setup_fee_high: 0,
          typical_monthly_fee_low: 0,
          typical_monthly_fee_high: 0,
          typical_performance_fee: 50,
          performance_fee_basis: "net_profit_percentage",
          performance_notes:
            "50% of net profit recovered from reactivated leads. Zero upfront. Zero monthly retainer.",
          pricing_notes:
            "Alternative models: $50 per booked appointment, or $25 per qualified conversation.",
        })
        .eq("id", agent.id)

      results.push({
        slug: agent.slug,
        name: agent.name,
        status: error ? "update_error" : "fixed_pricing_locked",
        error: error?.message,
      })
      continue
    }

    // Ask Claude for 2026 US market benchmarks for everything else. The
    // prompt nails down both the JSON shape and realistic ranges so output
    // doesn't drift into inflated figures.
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: `You are a pricing analyst for AI automation services in the United States in 2026. 
You provide realistic market benchmarks based on what AI automation agencies actually charge. 
All prices must be in USD. Use American English only.
Return valid JSON only — no markdown, no explanation, no preamble.`,
          messages: [
            {
              role: "user",
              content: `Provide realistic 2026 US market pricing benchmarks for this AI automation service:

Service: ${agent.name}
Category: ${agent.category}
Problem Solved: ${agent.problem_solved}
One Liner: ${agent.one_liner}
Description: ${agent.description}

Return this exact JSON format:

{
  "default_pricing_model": "retainer | hybrid_retainer | per_deliverable",
  "setup_fee_min": number,
  "setup_fee_max": number,
  "monthly_fee_min": number,
  "monthly_fee_max": number,
  "performance_fee_min": number or null,
  "performance_fee_max": number or null,
  "performance_fee_basis": "per_lead | per_conversation | per_booking | per_deliverable" or null,
  "performance_notes": "one sentence or null",
  "pricing_notes": "one sentence explaining what setup covers and how monthly scales"
}

PRICING GUIDELINES:
- All amounts in USD for US-based small/mid businesses
- Setup fees should reflect ~$150-$250/hour agency time × typical build hours
- Typical ranges:
  * FAQ bots / chatbots: $1,500-$4,000 setup, $400-$1,000/month
  * Appointment systems: $800-$2,500 setup, $250-$700/month  
  * Review/reputation tools: $500-$1,500 setup, $150-$400/month
  * Sales follow-up systems: $1,500-$4,000 setup, $500-$1,200/month
  * Lead qualification: $2,000-$5,000 setup, $500-$1,500/month
  * Booking systems: $1,500-$3,500 setup, $400-$1,000/month
  * Customer support bots: $3,000-$7,000 setup, $800-$2,000/month
- Use whole numbers rounded to nearest $50 or $100
- Hybrid pricing (retainer + performance) is appropriate for sales/lead services
- pricing_notes should be concise and specific to this service
- Avoid inflated or unrealistic figures — prices must be defensible

Return only the JSON object.`,
            },
          ],
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        results.push({
          slug: agent.slug,
          name: agent.name,
          status: "research_error",
          error: `Claude API ${response.status}: ${errText.slice(0, 200)}`,
        })
        continue
      }

      const data = await response.json()
      const text = data.content?.[0]?.text?.replace(/```json|```/g, "").trim() || ""
      const pricing: ClaudePricing = JSON.parse(text)

      // Map Claude's min/max fee fields to our DB columns. The live schema
      // stores performance_fee as a single integer, so we collapse the
      // min/max range by taking the lower bound (more defensible when
      // quoting the client) and let pricing_notes convey the range.
      const perfValue =
        pricing.performance_fee_min ??
        pricing.performance_fee_max ??
        null

      const { error } = await supabase
        .from("agents")
        .update({
          default_pricing_model: pricing.default_pricing_model,
          typical_setup_fee_low: pricing.setup_fee_min,
          typical_setup_fee_high: pricing.setup_fee_max,
          typical_monthly_fee_low: pricing.monthly_fee_min,
          typical_monthly_fee_high: pricing.monthly_fee_max,
          typical_performance_fee: perfValue,
          performance_fee_basis: pricing.performance_fee_basis,
          performance_notes: pricing.performance_notes,
          pricing_notes: pricing.pricing_notes,
        })
        .eq("id", agent.id)

      results.push({
        slug: agent.slug,
        name: agent.name,
        status: error ? "update_error" : "researched",
        pricing: error ? null : pricing,
        error: error?.message,
      })
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({
        slug: agent.slug,
        name: agent.name,
        status: "research_error",
        error: message,
      })
    }
  }

  return NextResponse.json({
    processed: results.length,
    succeeded: results.filter(
      (r) => r.status === "researched" || r.status === "fixed_pricing_locked",
    ).length,
    failed: results.filter((r) => r.status.includes("error")).length,
    results,
  })
}
