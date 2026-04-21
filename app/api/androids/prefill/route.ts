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

  const {
    business_name,
    website_url,
    // Agent Library context (optional). When present, Claude customises the
    // agent template for this specific business instead of producing a
    // generic Coffee Date Demo prompt.
    agent_slug,
    agent_name,
    android_prompt_template,
    // Audit context (optional). We lift `ai_insights` off the matching audit
    // row so Claude can ground the customisation in the audit's actual
    // bottlenecks / recommendations instead of web research alone.
    audit_id,
  } = await request.json()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  // If an audit_id came in, pull the insights so Claude has audit-grounded
  // context. We tolerate missing rows silently — the prefill still works.
  let auditContext = ""
  if (audit_id) {
    const { data: audit } = await supabase
      .from("audits")
      .select("ai_insights, responses")
      .eq("id", audit_id)
      .maybeSingle()
    if (audit?.ai_insights) {
      try {
        auditContext = `\n\nAudit insights for this business:\n${JSON.stringify(audit.ai_insights).slice(0, 4000)}`
      } catch {
        auditContext = ""
      }
    }
  }

  // Two system prompts depending on whether we're seeding from an agent
  // template or running the original generic research flow. Keeping them in
  // separate branches makes the intent obvious and keeps the agent branch
  // fully isolated so it can't regress the original behaviour.
  const isAgentBuild = Boolean(android_prompt_template)

  const systemPrompt = isAgentBuild
    ? `You are customising a deployable AI agent template for a specific business. The template below defines the core purpose and behaviour of the agent. Keep that purpose identical but weave in business-specific details (company name, services, tone, hours, promises, niche question) so the agent feels native to the client. Search for the business by name and visit their website to gather these details. Return valid JSON only. No markdown. No explanation. Just the JSON object.

Agent template (${agent_name || agent_slug || "Agent"}):
${android_prompt_template}`
    : `You are researching a business to help build an AI dead lead revival demo. Search for the business by name and visit their website. Extract key information to pre-fill a demo configuration form. Return valid JSON only. No markdown. No explanation. Just the JSON object.`

  const userMessage = `Research this business and extract information to pre-fill a demo form:

Business name: ${business_name}
Website: ${website_url}${auditContext}

Search for this business, visit their website, and return this exact JSON:
{
  "service_description": "2 sentence description of what the business does",
  "value_proposition": "what makes them different or better than competitors",
  "niche_question": "a natural conversation opener a returning customer would recognise",
  "region_tone": "communication style and region e.g. UK professional, US casual",
  "industry_training": "the industry for AI training e.g. Roofing, Legal Services",
  "opening_hours": "their opening hours if found, otherwise empty string",
  "promise_line": "a short trust-building phrase capturing their brand promise",
  "additional_context": "relevant context about typical customers, common questions, or business specifics"
}`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  })

  const data = await response.json()

  // Extract text blocks only — web search returns multiple content block types
  const textContent = data.content
    ?.filter((block: any) => block.type === "text")
    ?.map((block: any) => block.text)
    ?.join("")

  if (!textContent) {
    return NextResponse.json({ error: "No content returned from Claude" }, { status: 500 })
  }

  try {
    const clean = textContent.replace(/```json|```/g, "").trim()
    const result = JSON.parse(clean)

    // Claude with web search tooling leaves `<cite index="...">...</cite>`
    // tags in the string outputs. Strip them from every string field so the
    // UI (and the downstream Android prompt) never shows these tags.
    const stripCitations = (text: unknown): unknown => {
      if (typeof text !== "string") return text
      return text
        .replace(/<cite\b[^>]*\/>/gi, "")
        .replace(/<cite\b[^>]*>/gi, "")
        .replace(/<\/cite>/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    }

    const cleaned = Object.fromEntries(
      Object.entries(result).map(([k, v]) => [k, stripCitations(v)]),
    )

    return NextResponse.json(cleaned)
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 })
  }
}
