import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { business_name, website_url } = await request.json()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

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
      tools: [{
        "type": "web_search_20250305",
        "name": "web_search"
      }],
      system: `You are researching a business to help build an AI dead lead revival demo. Search for the business by name and visit their website. Extract key information to pre-fill a demo configuration form. Return valid JSON only. No markdown. No explanation. Just the JSON object.`,
      messages: [{
        role: "user",
        content: `Research this business and extract information to pre-fill a demo form:\n\nBusiness name: ${business_name}\nWebsite: ${website_url}\n\nSearch for this business, visit their website, and return this exact JSON:\n{\n  "service_description": "2 sentence description of what the business does",\n  "value_proposition": "what makes them different or better than competitors",\n  "niche_question": "a natural conversation opener a returning customer would recognise",\n  "region_tone": "communication style and region e.g. UK professional, US casual",\n  "industry_training": "the industry for AI training e.g. Roofing, Legal Services",\n  "opening_hours": "their opening hours if found, otherwise empty string",\n  "promise_line": "a short trust-building phrase capturing their brand promise",\n  "additional_context": "relevant context about typical customers, common questions, or business specifics"\n}`
      }]
    })
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
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Failed to parse response" }, { status: 500 })
  }
}
