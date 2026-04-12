import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { contact_name, business_name, niche, batch_size = 5 } = await request.json()

    // Get user's offer for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("offer_id")
      .eq("id", user.id)
      .single()

    let offerContext = ""
    if (profile?.offer_id) {
      const { data: offer } = await supabase
        .from("offers")
        .select("service_name, outcome_statement, price_point, guarantee")
        .eq("id", profile.offer_id)
        .single()

      if (offer) {
        offerContext = `
Service: ${offer.service_name}
Outcome: ${offer.outcome_statement}
Price: ${offer.price_point || "Not specified"}
Guarantee: ${offer.guarantee || "None"}`
      }
    }

    // Call Claude to generate messages
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
        system: `You are an expert cold outreach copywriter. Generate ${batch_size} different cold outreach messages for a dead lead revival campaign.

Each message should:
- Be personalized using the contact and business name
- Reference their industry/niche naturally
- Be conversational and not salesy
- Be under 160 characters (SMS-friendly)
- Have a soft call-to-action (question, not demand)
- Feel like it's from a real person, not a template

${offerContext ? `The sender's offer:\n${offerContext}` : ""}

Return ONLY a JSON array of objects with this exact structure:
[
  {
    "message_body": "the message text"
  }
]

Do not include any other text, just the JSON array.`,
        messages: [
          {
            role: "user",
            content: `Generate ${batch_size} cold outreach messages for:
Contact Name: ${contact_name || "there"}
Business Name: ${business_name || "your business"}
Niche: ${niche || "small business"}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Anthropic API error:", error)
      return NextResponse.json({ error: "Failed to generate messages" }, { status: 500 })
    }

    const data = await response.json()
    const content = data.content[0]?.text

    // Parse the JSON response
    let messages
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        messages = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON array found in response")
      }
    } catch (parseError) {
      console.error("Failed to parse Claude response:", content)
      return NextResponse.json({ error: "Failed to parse generated messages" }, { status: 500 })
    }

    // Store messages in database
    const messagesToInsert = messages.map((msg: any) => ({
      user_id: user.id,
      contact_name: contact_name || null,
      business_name: business_name || null,
      message_body: msg.message_body,
      status: "draft",
    }))

    const { data: insertedMessages, error: insertError } = await supabase
      .from("outreach_messages")
      .insert(messagesToInsert)
      .select()

    if (insertError) {
      console.error("Failed to insert messages:", insertError)
      return NextResponse.json({ error: "Failed to save messages" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messages: insertedMessages,
      count: insertedMessages?.length || 0,
    })
  } catch (error: any) {
    console.error("Outreach generate error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
