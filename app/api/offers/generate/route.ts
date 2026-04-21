import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"
import { trackActivity } from "@/lib/trackActivity"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await checkAccess()
    const gate = subscriptionGateResponse(access)
    if (gate) return gate

    const { niche, problem, outcome } = await request.json()

    if (!niche || !problem || !outcome) {
      return NextResponse.json(
        { error: "niche, problem, and outcome are required" },
        { status: 400 }
      )
    }

    // Generate offer using direct Anthropic API call
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: "You are the AI engine inside Aether Revive, an AI client acquisition system. Generate a complete sellable service offer for someone building their first AI agency. Always use USD. Never use GBP or any other currency. Return valid JSON only. No markdown. No explanation. Just the JSON object.",
        messages: [{
          role: "user",
          content: `Generate a complete service offer based on:\nNiche: ${niche}\nProblem they solve: ${problem}\nOutcome they deliver: ${outcome}\n\nReturn this exact JSON:\n{\n  "service_name": "Use the business category and niche as the title. Just the niche name, not a system or service description. For example: 'Local Restaurants', 'Estate Agents', 'Fitness Coaches', 'Dental Practices'. Keep it simple - just the business type.",\n  "outcome_statement": "one sentence exact result the client gets",\n  "price_point": "suggest the most appropriate pricing model for this specific service type. Use USD only. For lead generation or revival services use performance-based pricing e.g. $X per qualified lead or 10-15% of recovered revenue. For ongoing AI services use monthly retainer e.g. $500-$1500/month. For one-off audits or setup use project pricing e.g. $750-$2500. Match the model to the niche and outcome, do not default to a fixed monthly retainer for every service type.",\n  "pricing_model": "retainer or performance or project or hybrid — whichever fits this service",\n  "guarantee": "simple risk-reducing guarantee statement",\n  "confidence_score": "strong or needs_work or weak",\n  "confidence_reason": "one sentence explaining the score"\n}`
        }]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Anthropic API error:", errorData)
      return NextResponse.json(
        { error: "Failed to generate offer" },
        { status: 500 }
      )
    }

    const data = await response.json()
    const text = data.content[0].text.replace(/```json|```/g, "").trim()
    const offer = JSON.parse(text)

    // Insert into offers table
    const { data: offerData, error: insertError } = await supabase
      .from("offers")
      .insert({
        user_id: user.id,
        niche,
        service_name: offer.service_name,
        outcome_statement: offer.outcome_statement,
        price_point: offer.price_point,
        pricing_model: offer.pricing_model,
        guarantee: offer.guarantee,
        confidence_score: offer.confidence_score,
        confidence_reason: offer.confidence_reason,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Insert error:", insertError)
      return NextResponse.json(
        { error: "Failed to save offer" },
        { status: 500 }
      )
    }

    // Update profiles.offer_id
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ offer_id: offerData.id })
      .eq("id", user.id)

    if (profileError) {
      console.error("Profile update error:", profileError)
      // Don't fail - offer was created, just profile link failed
    }

    // Re-engagement tracking: user is actively building their offer.
    await trackActivity(user.id, "offer_created")

    return NextResponse.json({ offer: offerData })
  } catch (error) {
    console.error("Generate offer error:", error)
    return NextResponse.json(
      { error: "Failed to generate offer" },
      { status: 500 }
    )
  }
}
