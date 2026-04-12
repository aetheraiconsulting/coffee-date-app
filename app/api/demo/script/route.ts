import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's offer
    const { data: profile } = await supabase
      .from("profiles")
      .select("offer_id")
      .eq("id", user.id)
      .single()

    if (!profile?.offer_id) {
      return NextResponse.json({ error: "No offer found. Please create an offer first." }, { status: 400 })
    }

    const { data: offer } = await supabase
      .from("offers")
      .select("*")
      .eq("id", profile.offer_id)
      .single()

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 400 })
    }

    // Check if script already exists
    const { data: existingScript } = await supabase
      .from("call_scripts")
      .select("*")
      .eq("user_id", user.id)
      .eq("offer_id", profile.offer_id)
      .single()

    if (existingScript) {
      return NextResponse.json({ script: existingScript })
    }

    // Generate script via Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: `You are an expert sales coach creating a discovery call script for a service provider.

The user's offer:
- Service: ${offer.service_name}
- Outcome: ${offer.outcome_statement}
- Price: ${offer.price_point || "To be discussed"}
- Guarantee: ${offer.guarantee || "None specified"}

Generate a natural, conversational call script with these sections:
1. Opening (2-3 sentences to build rapport and set the agenda)
2. Qualification Questions (3-4 questions to understand their situation and pain points)
3. Objection Responses (3 common objections with smooth responses)
4. Close Ask (the exact words to ask for the sale or next step)

Return as JSON:
{
  "opening": "string",
  "qualification_questions": "string (numbered list)",
  "objection_responses": "string (formatted as Objection: ... Response: ...)",
  "close_ask": "string"
}`,
        messages: [
          {
            role: "user",
            content: "Generate the call script based on my offer."
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error("Failed to generate script")
    }

    const data = await response.json()
    const content = data.content[0].text

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid response format")
    }

    const scriptData = JSON.parse(jsonMatch[0])

    // Save to database
    const { data: newScript, error: insertError } = await supabase
      .from("call_scripts")
      .insert({
        user_id: user.id,
        offer_id: profile.offer_id,
        opening: scriptData.opening,
        qualification_questions: scriptData.qualification_questions,
        objection_responses: scriptData.objection_responses,
        close_ask: scriptData.close_ask,
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ script: newScript })

  } catch (error: any) {
    console.error("Script generation error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: script } = await supabase
      .from("call_scripts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ script: script || null })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
