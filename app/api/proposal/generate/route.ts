import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { prospect_name, prospect_business, additional_context } = body

    // Get user's offer
    const { data: profile } = await supabase
      .from("profiles")
      .select("offer_id")
      .eq("id", user.id)
      .single()

    if (!profile?.offer_id) {
      return NextResponse.json({ error: "No offer found" }, { status: 400 })
    }

    const { data: offer } = await supabase
      .from("offers")
      .select("*")
      .eq("id", profile.offer_id)
      .single()

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 400 })
    }

    // Get most recent completed call script
    const { data: callScript } = await supabase
      .from("call_scripts")
      .select("id, call_notes, offer_id")
      .eq("user_id", user.id)
      .eq("call_completed", true)
      .order("call_completed_at", { ascending: false })
      .limit(1)
      .single()

    // Call Claude to generate proposal
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: "You are the AI engine inside Aether Revive. Write a concise, professional proposal for an AI service. The proposal must be client-ready — clear, specific, and easy to say yes to. No jargon. No fluff. Return valid JSON only. No markdown. No explanation.",
        messages: [{
          role: "user",
          content: `Write a client-ready proposal based on:

Service: ${offer.service_name}
Niche: ${offer.niche}
Outcome: ${offer.outcome_statement}
Price: ${offer.price_point}
Guarantee: ${offer.guarantee}

Call notes: ${callScript?.call_notes || "No notes provided"}
${prospect_name ? `\nProspect: ${prospect_name}` : ""}${prospect_business ? `\nBusiness: ${prospect_business}` : ""}${additional_context ? `\nAdditional context: ${additional_context}` : ""}

Return this exact JSON:
{
  "problem_summary": "2-3 sentences describing their specific problem based on the call notes",
  "solution_summary": "2-3 sentences describing exactly what you will do for them",
  "deliverables": "bullet-point list of exactly what is included",
  "investment": "price, payment terms, and what they get for it",
  "guarantee": "the guarantee statement rewritten for this specific prospect",
  "next_step": "exact next action — e.g. sign and return this proposal to begin on Monday",
  "confidence_score": "strong or needs_work or weak",
  "confidence_reason": "one sentence on why this proposal will or won't convert"
}`
        }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "Claude API error")
    }

    const data = await response.json()
    const text = data.content[0].text.replace(/```json|```/g, "").trim()
    const result = JSON.parse(text)

    // Save to proposals table
    const { data: proposal, error } = await supabase
      .from("proposals")
      .insert({
        user_id: user.id,
        offer_id: profile.offer_id,
        call_script_id: callScript?.id || null,
        prospect_name: prospect_name || null,
        prospect_business: prospect_business || null,
        problem_summary: result.problem_summary,
        solution_summary: result.solution_summary,
        deliverables: result.deliverables,
        investment: result.investment,
        guarantee: result.guarantee,
        next_step: result.next_step,
        confidence_score: result.confidence_score,
        confidence_reason: result.confidence_reason,
        sent: false,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ proposal })
  } catch (error: any) {
    console.error("Proposal generation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate proposal" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get most recent proposal
  const { data: proposal } = await supabase
    .from("proposals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ proposal: proposal || null })
}
