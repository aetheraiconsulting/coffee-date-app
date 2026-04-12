import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateText } from "ai"
import { gateway } from "@ai-sdk/gateway"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { niche, industry } = await request.json()

    if (!niche || !industry) {
      return NextResponse.json(
        { error: "niche and industry are required" },
        { status: 400 }
      )
    }

    // Generate offer using Claude via AI Gateway
    const { text } = await generateText({
      model: gateway("anthropic/claude-sonnet-4-20250514"),
      system: `You are an expert at crafting irresistible offers for AI automation services. 
You help entrepreneurs create offers that convert cold leads into paying clients.
Your offers are specific, outcome-focused, and create urgency without being pushy.
Always respond with valid JSON only, no markdown or explanation.`,
      prompt: `Generate a compelling offer for an AI automation service targeting the ${niche} niche in the ${industry} industry.

The offer should help business owners revive their dead leads using AI-powered conversations.

Return a JSON object with these exact fields:
{
  "headline": "A bold, attention-grabbing headline (max 10 words)",
  "subheadline": "Supporting text that adds context (max 20 words)",
  "problem": "The specific pain point this solves (1-2 sentences)",
  "solution": "What the AI service does to solve it (1-2 sentences)",
  "proof": "Social proof or credibility statement (1 sentence)",
  "cta": "Call-to-action text for a button (max 5 words)"
}

Make it specific to ${niche} businesses. Use concrete numbers where possible.`,
    })

    // Parse the generated JSON
    let offer
    try {
      // Clean the response - remove any markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      offer = JSON.parse(cleanedText)
    } catch {
      return NextResponse.json(
        { error: "Failed to parse generated offer" },
        { status: 500 }
      )
    }

    // Insert into offers table
    const { data: offerData, error: insertError } = await supabase
      .from("offers")
      .insert({
        user_id: user.id,
        niche,
        industry,
        headline: offer.headline,
        subheadline: offer.subheadline,
        problem: offer.problem,
        solution: offer.solution,
        proof: offer.proof,
        cta: offer.cta,
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
