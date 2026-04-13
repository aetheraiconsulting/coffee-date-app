import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type Channel = "linkedin" | "instagram" | "email"

const channelInstructions: Record<Channel, {
  format: string
  length: string
  tone: string
  cta: string
  extra: string
}> = {
  linkedin: {
    format: "LinkedIn DM",
    length: "100-150 words maximum",
    tone: "Professional but human. Peer to peer. No corporate speak.",
    cta: "invite them to a quick 10-minute screen share demo — not a sales call",
    extra: "No subject line needed. Start with an observation about their business type."
  },
  instagram: {
    format: "Instagram DM",
    length: "60-80 words maximum — short and punchy",
    tone: "Casual, direct, conversational. Like a real person messaging.",
    cta: "invite them to see a quick demo — keep it low pressure",
    extra: "No formal language. No subject line. Get to the point fast."
  },
  email: {
    format: "Cold email with subject line",
    length: "150-200 words for body. Subject line: 6-8 words maximum.",
    tone: "Professional but not corporate. Clear and direct.",
    cta: "invite them to a 10-minute screen share to see the system working on their type of business",
    extra: "Include a subject line as a separate field. Opening line must reference their specific business type."
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { channel, prospect_context } = await request.json()
    const selectedChannel: Channel = channel || "linkedin"
    const selected = channelInstructions[selectedChannel]

    // Fetch active offer server-side
    const { data: offer } = await supabase
      .from("offers")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!offer) {
      return NextResponse.json({ error: "No active offer found" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 })
    }

    // Call Claude to generate messages
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: `You are the AI engine inside Aether Revive. Write 20 cold outreach messages that get replies and book demo calls. The goal of every message is ONE THING ONLY: get the prospect to agree to a 10-minute screen share demo. Do NOT pitch the service. Do NOT mention price. Do NOT describe features. Just get them curious enough to say yes to seeing a demo. Format: ${selected.format}. Length: ${selected.length}. Tone: ${selected.tone}. CTA: ${selected.cta}. ${selected.extra} Return valid JSON only. No markdown. No explanation.`,
        messages: [{
          role: "user",
          content: `Write exactly 20 outreach messages for this service:

Service: ${offer.service_name}
Target niche: ${offer.niche}
Outcome we deliver: ${offer.outcome_statement}
Pricing model: ${offer.pricing_model}
Guarantee: ${offer.guarantee}
${prospect_context ? `\nProspect context: ${prospect_context}` : ""}

CRITICAL: Every message must invite the prospect to a 10-minute screen share demo — NOT pitch the service or mention price.

Each message must:
- Open with a specific observation about ${offer.niche} businesses
- Reference a pain point they likely have
- Mention you have built something specific for their type of business
- End with a soft ask to see a 10-minute demo
- Sound like a real person, not a salesperson
- Be varied — no two messages with the same opening

${selectedChannel === "email" ? 'Return JSON with subject_line and message_text for each message.' : 'Return JSON with message_text only for each message.'}

Return this exact JSON:
{
  "messages": [
    {
      ${selectedChannel === "email" ? '"subject_line": "email subject here",' : ''}
      "message_text": "full message here"
    }
  ]
}`
        }]
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Anthropic API error:", error)
      return NextResponse.json({ error: "Failed to generate messages" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content[0].text.replace(/```json|```/g, "").trim()
    
    let result
    try {
      result = JSON.parse(text)
    } catch (parseError) {
      console.error("Failed to parse Claude response:", text)
      return NextResponse.json({ error: "Failed to parse generated messages" }, { status: 500 })
    }

    // Save messages to outreach_messages with channel field
    const messagesToInsert = result.messages.map((m: { message_text: string; subject_line?: string }) => ({
      user_id: user.id,
      offer_id: offer.id,
      message_text: m.message_text,
      subject_line: m.subject_line || null,
      status: "draft",
      channel: selectedChannel
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
