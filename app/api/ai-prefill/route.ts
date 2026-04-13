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

    const { website } = await request.json()

    if (!website || typeof website !== "string") {
      return NextResponse.json({ error: "Website URL is required" }, { status: 400 })
    }

    // Normalize URL
    let normalizedUrl = website.trim()
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      normalizedUrl = "https://" + normalizedUrl
    }

    // Fetch website content
    let websiteContent = ""
    try {
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AetherBot/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      })
      
      if (response.ok) {
        const html = await response.text()
        // Extract text content from HTML (basic extraction)
        websiteContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000) // Limit content length
      }
    } catch (fetchError) {
      console.error("Error fetching website:", fetchError)
      // Continue without website content
    }

    const prompt = `You are an AI assistant helping to pre-fill a form for creating an AI sales assistant (called an "Android") for a business.

Based on the following website content, extract and generate the following fields. If you cannot determine a field, leave it as an empty string.

Website URL: ${normalizedUrl}
${websiteContent ? `Website Content:\n${websiteContent}` : "Note: Could not fetch website content. Make reasonable guesses based on the URL."}

Return a JSON object with these fields:
- businessName: The business name (string)
- shortService: A one-sentence description of what the business does (string)
- valueProp: What makes this business different or better (string)
- nicheQuestion: A simple qualifying question the AI could ask prospects (string)
- regionTone: The communication style/region tone (e.g. "UK professional", "casual", "friendly") (string)
- industryTraining: The industry category (e.g. "Roofing", "HVAC", "Legal Services") (string)
- openingHours: Business hours if mentioned (string)
- promiseLine: A short trust-building phrase (string)

Only return valid JSON, no markdown or explanation.`

    const { text } = await generateText({
      model: gateway("openai/gpt-4o-mini"),
      prompt,
    })

    // Parse the JSON response
    let prefillData
    try {
      // Clean the response in case it has markdown code blocks
      const cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      prefillData = JSON.parse(cleanedText)
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError, text)
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      prefillData: {
        businessName: prefillData.businessName || "",
        shortService: prefillData.shortService || "",
        valueProp: prefillData.valueProp || "",
        nicheQuestion: prefillData.nicheQuestion || "",
        regionTone: prefillData.regionTone || "",
        industryTraining: prefillData.industryTraining || "",
        openingHours: prefillData.openingHours || "",
        promiseLine: prefillData.promiseLine || "",
        website: normalizedUrl,
      },
    })
  } catch (error) {
    console.error("AI Prefill error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
