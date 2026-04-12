import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateObject } from "ai"
import { gateway } from "@ai-sdk/gateway"
import { z } from "zod"

const offerSchema = z.object({
  service_name: z.string().describe("A clear, specific name for the service (e.g., 'AI Lead Revival System')"),
  outcome_statement: z.string().describe("One sentence describing the specific outcome delivered (e.g., 'We help real estate agents book 5+ listing appointments per month from their dead leads')"),
  price_point: z.string().describe("Suggested price point or pricing model (e.g., '$2,000/month' or '$500 setup + $1,500/month')"),
  guarantee: z.string().describe("A specific, risk-reversing guarantee (e.g., 'Book 3 calls in 30 days or your money back')"),
  confidence_score: z.number().min(1).max(10).describe("How confident is this offer to convert (1-10)"),
  confidence_reason: z.string().describe("Brief explanation of why this score (e.g., 'Strong niche with clear pain point and measurable outcome')"),
})

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

    // Generate offer using Claude via AI Gateway with structured output
    const { object: offer } = await generateObject({
      model: gateway("anthropic/claude-sonnet-4-20250514"),
      schema: offerSchema,
      system: `You are an expert at crafting irresistible offers for AI automation services.
You help entrepreneurs create offers that convert cold leads into paying clients.
Your offers are specific, outcome-focused, and include strong guarantees that reduce risk.
Focus on measurable outcomes and concrete numbers.`,
      prompt: `Generate a compelling offer for an AI lead revival service targeting ${niche} in the ${industry} industry.

The service helps business owners revive their dead leads using AI-powered conversations to book calls and close deals.

Create an offer that:
1. Has a clear, professional service name
2. Promises a specific, measurable outcome
3. Includes realistic pricing for this type of service
4. Offers a strong guarantee that reverses risk
5. Would genuinely appeal to ${niche} businesses

Be specific and use concrete numbers where possible.`,
    })

    // Insert into offers table
    const { data: offerData, error: insertError } = await supabase
      .from("offers")
      .insert({
        user_id: user.id,
        niche,
        industry,
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
