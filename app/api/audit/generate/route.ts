import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"
import { trackActivity } from "@/lib/trackActivity"
// Phase 4G — after Claude returns service recommendations we match each rec
// to a deployable Agent Library entry and persist the agent's pricing onto
// the audit row so the builder can render concrete quote numbers without a
// second round-trip.
import { formatAgentPricing, type AgentPricing } from "@/lib/pricing"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const access = await checkAccess()
  const gate = subscriptionGateResponse(access)
  if (gate) return gate

  const { audit_id } = await request.json()

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("id", audit_id)
    .eq("user_id", user.id)
    .single()

  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Missing API key" }, { status: 500 })

  const responses = audit.responses || {}
  
  // Build a readable summary of all responses
  const responsesSummary = Object.entries(responses)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: `You are an expert AI business consultant conducting an AI readiness audit for a business. 
You analyze audit responses and provide specific, actionable recommendations.
You always recommend Dead Lead Revival as the highest priority service when dormant leads are mentioned.
You recommend AI services that the consultant can sell to this client.
Be specific — reference the client's actual answers in your recommendations.
Write in American English and quote every monetary figure in US dollars with a "$" symbol — never GBP, never "£", never "pounds".
Return valid JSON only. No markdown. No explanation.`,
      messages: [{
        role: "user",
        content: `Analyze this AI readiness audit and generate recommendations.

Business: ${audit.name}
Industry: ${audit.industry || "Not specified"}
Size: ${audit.business_size || "Not specified"}

AUDIT RESPONSES:
${responsesSummary}

Return this exact JSON:
{
  "executive_summary": "3-4 sentence client-facing summary of their current AI position and the opportunity available to them. Professional, specific, reference their actual business.",
  "bottlenecks": [
    {"issue": "specific bottleneck identified", "evidence": "quote or reference from their responses", "impact": "business cost of this bottleneck"}
  ],
  "quick_wins": [
    {"action": "specific quick win", "timeline": "how fast this can be implemented", "outcome": "expected result"}
  ],
  "roadmap": [
    {"phase": "Phase 1 — Weeks 1-4", "focus": "what to implement", "outcome": "expected result"},
    {"phase": "Phase 2 — Weeks 5-8", "focus": "what to implement", "outcome": "expected result"},
    {"phase": "Phase 3 — Weeks 9-12", "focus": "what to implement", "outcome": "expected result"}
  ],
  "financial_impact": "Specific estimated ROI based on their actual business size and responses — include dollar amounts where possible",
  "service_recommendations": [
    {
      "service": "service name",
      "priority": "critical or high or medium",
      "problem_solved": "specific problem from their responses this solves",
      "expected_outcome": "measurable outcome for this client",
      "pricing_model": "suggested pricing model — one of: '50% of net profit recovered', OR '$X per qualified lead', OR '$X per booked conversation', OR 'Monthly retainer'. Use 'net profit' (not 'net revenue') when describing profit-share.",
      "why_now": "why this is the right time for this client specifically"
    }
  ]
}

CRITICAL RULES:
- Dead Lead Revival must always be included in service_recommendations if they mention dormant leads, old contacts, or lack of follow-up system
- Score Dead Lead Revival as "critical" priority if they have old leads sitting in their database
- All recommendations must reference specific answers from their audit
- Financial impact must include specific numbers based on their business size and industry
- Minimum 3 service recommendations, maximum 8
- Services to consider: Dead Lead Revival, AI Chatbot/Lead Capture, AI Follow-up Sequences, AI Scheduling Assistant, AI Proposal Generator, AI Customer Support Bot, AI Review and Feedback System, AI Sales Analytics`
      }]
    })
  })

  const data = await response.json()
  
  if (!data.content || !data.content[0]) {
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 })
  }
  
  const text = data.content[0].text.replace(/```json|```/g, "").trim()
  const result = JSON.parse(text)

  // Pull every public agent with its pricing columns and keyword matcher,
  // then run the same lowercase-substring match the builder uses client-side.
  // Matching is O(recs × agents × keywords) — cheap at these sizes. We save
  // the FIRST match per recommendation index so the UI can surface the agent
  // name, ROI, and concrete pricing without re-matching on the client.
  const { data: publicAgents } = await supabase
    .from("agents")
    .select(
      "id, slug, name, category, typical_roi, service_recommendation_keywords, default_pricing_model, setup_fee_min, setup_fee_max, monthly_fee_min, monthly_fee_max, performance_fee_min, performance_fee_max, performance_fee_basis, performance_notes, pricing_notes",
    )
    .eq("is_public", true)

  // `pricing_suggestions` is keyed by the recommendation index (stringified
  // because JSONB keys are strings). Each value contains the agent IDs + the
  // already-formatted pricing line so consumers can render without importing
  // the formatter (e.g. future server renders / PDF exports).
  const pricingSuggestions: Record<
    string,
    {
      agent_id: string
      agent_slug: string
      agent_name: string
      typical_roi: string | null
      model_label: string
      pricing_display: string
      pricing_notes: string | null
    }
  > = {}

  if (Array.isArray(publicAgents) && Array.isArray(result.service_recommendations)) {
    result.service_recommendations.forEach((rec: any, idx: number) => {
      const haystack = `${rec.service || ""} ${rec.problem_solved || ""} ${rec.expected_outcome || ""}`.toLowerCase()
      const matched = publicAgents.find((agent: any) => {
        const keywords: unknown = agent.service_recommendation_keywords
        if (!Array.isArray(keywords)) return false
        return keywords.some(
          (kw) => typeof kw === "string" && kw.length > 0 && haystack.includes(kw.toLowerCase()),
        )
      })
      if (!matched) return

      const formatted = formatAgentPricing(matched as AgentPricing)
      pricingSuggestions[String(idx)] = {
        agent_id: matched.id,
        agent_slug: matched.slug,
        agent_name: matched.name,
        typical_roi: matched.typical_roi ?? null,
        model_label: formatted.modelLabel,
        pricing_display: formatted.primary,
        pricing_notes: formatted.notes,
      }
    })
  }

  // Save generated insights + pricing suggestions to audit record.
  await supabase
    .from("audits")
    .update({
      ai_insights: {
        bottlenecks: result.bottlenecks,
        quick_wins: result.quick_wins,
        roadmap: result.roadmap,
        financial_impact: result.financial_impact,
      },
      executive_summary: result.executive_summary,
      service_recommendations: result.service_recommendations,
      edited_insights: {
        bottlenecks: result.bottlenecks,
        quick_wins: result.quick_wins,
        roadmap: result.roadmap,
        financial_impact: result.financial_impact,
        executive_summary: result.executive_summary,
        service_recommendations: result.service_recommendations,
      },
      pricing_suggestions: pricingSuggestions,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", audit_id)

  // Re-engagement tracking: audit generated for a client.
  await trackActivity(user.id, "audit_sent")

  return NextResponse.json(result)
}
