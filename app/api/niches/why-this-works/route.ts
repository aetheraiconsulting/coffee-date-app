import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { niche_name, industry_name, niche_id } = await request.json()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: `You are an expert AI business consultant who helps marketing agencies and entrepreneurs identify high-value niches for AI dead lead revival services. You write compelling, specific, credible analysis that makes people excited to pursue a niche. Never be generic. Always include specific numbers, realistic revenue figures, and insider knowledge about the niche. Write like someone who has actually worked in this industry.`,
      messages: [{
        role: "user",
        content: `Write a compelling 4-sentence "Why This Works" analysis for targeting ${niche_name} businesses in the ${industry_name} industry with an AI dead lead revival service.

The analysis must cover:
1. The typical database size these businesses have (be specific with numbers)
2. The average transaction value and what reactivating even a small percentage means in revenue
3. Why AI specifically fits this niche better than manual follow-up
4. A conviction statement that ends with confidence about why this is worth pursuing

Rules:
- Include specific dollar amounts and percentages
- Reference the actual pain point these businesses face with dormant leads
- Make the reader feel like they have insider knowledge
- End with a statement that creates conviction to act
- No bullet points — write as a single flowing paragraph
- Do not use the word "transform", "unlock", "game-changer", or "revolutionary"
- Maximum 120 words

Return plain text only. No JSON. No markdown.`
      }]
    })
  })

  if (!response.ok) {
    const error = await response.text()
    console.error("Claude API error:", error)
    return NextResponse.json({ error: "Failed to generate analysis" }, { status: 500 })
  }

  const data = await response.json()
  const content = data.content[0].text.trim()

  // Cache the result in niche_user_state
  await supabase
    .from("niche_user_state")
    .upsert({
      user_id: user.id,
      niche_id: niche_id,
      why_this_works_content: content,
    }, { onConflict: "user_id,niche_id" })

  return NextResponse.json({ content })
}
