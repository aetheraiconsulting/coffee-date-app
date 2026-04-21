import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"

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
You analyse audit responses and provide specific, actionable recommendations.
You always recommend Dead Lead Revival as the highest priority service when dormant leads are mentioned.
You recommend AI services that the consultant can sell to this client.
Be specific — reference the client's actual answers in your recommendations.
Return valid JSON only. No markdown. No explanation.`,
      messages: [{
        role: "user",
        content: `Analyse this AI readiness audit and generate recommendations.

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
      "pricing_model": "suggested pricing model e.g. 50% profit share or $X per lead",
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

  // Save generated insights to audit record
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
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", audit_id)

  return NextResponse.json(result)
}
