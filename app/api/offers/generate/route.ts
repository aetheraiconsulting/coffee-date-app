import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
        system: "You are the AI engine inside Aether Revive, an AI client acquisition system. Generate a complete sellable service offer for someone building their first AI agency. Return valid JSON only. No markdown. No explanation. Just the JSON object.",
        messages: [{
          role: "user",
          content: `Generate a complete service offer based on:\nNiche: ${niche}\nProblem they solve: ${problem}\nOutcome they deliver: ${outcome}\n\nReturn this exact JSON:\n{\n  "service_name": "short specific service name max 6 words",\n  "outcome_statement": "one sentence exact result the client gets",\n  "price_point": "specific price appropriate for a beginner e.g. £500/month or £750 one-off",\n  "guarantee": "simple risk-reducing guarantee statement",\n  "confidence_score": "strong or needs_work or weak",\n  "confidence_reason": "one sentence explaining the score"\n}`
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

    return NextResponse.json({ offer: offerData })
  } catch (error) {
    console.error("Generate offer error:", error)
    return NextResponse.json(
      { error: "Failed to generate offer" },
      { status: 500 }
    )
  }
}
