// NOTE: This route uses OpenAI. Scheduled for migration to Claude in Phase 2.
import type { NextRequest } from "next/server"
import { generateText } from "ai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Generate API called")
    const { type, nicheName, context } = await request.json()
    console.log("[v0] Type:", type, "Niche:", nicheName)

    if (!process.env.OPENAI_API_KEY) {
      console.error("[v0] OPENAI_API_KEY not configured")
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    let systemPrompt = ""
    let userPrompt = ""

    switch (type) {
      case "customer_profile":
        systemPrompt = "You are an expert business analyst specializing in customer profiling and market research."
        userPrompt = `Generate a detailed customer profile for "${nicheName}" businesses. 

Include the following in your response as a JSON object:
- decision_maker: Who makes purchasing decisions (title/role)
- pain_points: Top 3-5 pain points this business faces
- objections: Common objections they have to new services
- buying_triggers: What motivates them to buy
- language_style: How they communicate (formal/casual, technical/simple)
- gathering_places: Where they hang out online (specific platforms, groups, forums)

Return ONLY the JSON object, no other text.`
        break

      case "messaging":
        systemPrompt = "You are an expert copywriter specializing in B2B outreach and lead generation."
        userPrompt = `Generate outreach messaging scripts for "${nicheName}" businesses.

Include the following in your response as a JSON object:
- linkedin: A compelling LinkedIn connection message (max 300 chars)
- email: A cold email subject and body (include both subject and body in the string)
- facebook: A Facebook group post angle
- forum: A forum post approach
- lead_magnet: 3 lead magnet ideas (as a string or array)

Return ONLY the JSON object, no other text.`
        break

      case "demo_script":
        systemPrompt = "You are an expert sales trainer specializing in SaaS demos and consultative selling."
        userPrompt = `Create a Coffee Date Demo script for "${nicheName}" businesses showcasing Aether Revive's dead lead revival features.

Structure the demo script with:
1. Opening (build rapport, set agenda)
2. Discovery (ask questions about their lead situation)
3. Demo (show 3 key features)
4. Value Proposition (ROI, benefits)
5. Next Steps (trial/pricing conversation)

Make it conversational and consultative, not pushy. Include specific questions to ask.`
        break

      default:
        console.error("[v0] Invalid generation type:", type)
        return Response.json({ error: "Invalid generation type" }, { status: 400 })
    }

    console.log("[v0] Generating text with AI...")
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      prompt: userPrompt,
    })
    console.log("[v0] AI response received, length:", text.length)

    // For JSON responses, try to parse them
    if (type === "customer_profile" || type === "messaging") {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          console.log("[v0] Successfully parsed JSON response")
          return Response.json({ success: true, data: parsed })
        }
        console.log("[v0] No JSON found in response, returning as text")
      } catch (e) {
        console.error("[v0] JSON parsing error:", e)
        // If parsing fails, return as text
      }
    }

    return Response.json({ success: true, data: text })
  } catch (error) {
    console.error("[v0] Generate API error:", error)
    return Response.json(
      { error: "Failed to generate content", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
