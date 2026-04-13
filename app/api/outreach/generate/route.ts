import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

type Channel = "linkedin" | "instagram" | "email"

const channelInstructions: Record<Channel, {
  format: string
  length: string
  tone: string
  extra: string
}> = {
  linkedin: {
    format: "LinkedIn DM",
    length: "100-150 words maximum",
    tone: "Professional but human. Peer to peer. No corporate speak.",
    extra: "No subject line needed. Start with tactical empathy about their business type."
  },
  instagram: {
    format: "Instagram DM",
    length: "60-80 words maximum — short and punchy",
    tone: "Casual, direct, conversational. Like a real person messaging.",
    extra: "No formal language. No subject line. Get to the point fast."
  },
  email: {
    format: "Cold email with subject line",
    length: "150-200 words for body. Subject line: 6-8 words maximum.",
    tone: "Professional but not corporate. Clear and direct.",
    extra: "Include a subject line as a separate field. Subject line must use a no-oriented or curiosity-gap approach — never a salesy subject line."
  }
}

const systemPrompt = `You are the AI engine inside Aether Revive. You write cold outreach messages using two frameworks combined:

FRAMEWORK 1 — 3C Storytelling (Adam Stacey):
- Clarity: The message immediately communicates the prospect's problem and the outcome available to them. No ambiguity.
- Connection: The message speaks directly to their world. References something specific about their niche that makes them feel understood, not targeted.
- Conviction: The message ends with confidence, not desperation. The sender is a guide, not a salesperson. The prospect is always the hero.
- Rule: Never make the message about the sender's service. Make it about the prospect's problem and the result they could get.

FRAMEWORK 2 — Chris Voss Tactical Empathy:
- Open with tactical empathy: demonstrate you understand their world before asking for anything
- Use accusation audit: pre-empt their objection e.g. "You're probably getting pitched AI services every week right now..."
- Use labelling: name what they are likely feeling e.g. "It sounds like follow-up is the part that always slips..."
- Use no-oriented questions: instead of "would you be open to a chat?" use "would it be crazy to spend 10 minutes seeing this?" A no-oriented question is psychologically easier to say yes to.
- Use late night FM DJ tone: calm, unhurried, confident. Never excitable or salesy.
- Never use high-pressure language. Never mention urgency or scarcity.

COMBINED RULE: Every message must feel like it was written by a trusted peer who genuinely understands the prospect's business — not by a salesperson who wants their money.

The goal of every message is ONE THING ONLY: get the prospect to agree to a 10-minute screen share demo. Do NOT pitch the service. Do NOT mention price. Do NOT list features.

Return valid JSON only. No markdown. No explanation.`

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

    const userMessage = `Write exactly 20 cold outreach messages using the 3C Storytelling Framework and Chris Voss tactical empathy techniques.

Service context (for your reference only — do NOT pitch this directly):
Service: ${offer.service_name}
Target niche: ${offer.niche}
Outcome we deliver: ${offer.outcome_statement}
Guarantee: ${offer.guarantee}
${prospect_context ? `\nProspect context: ${prospect_context}` : ""}

Channel: ${selected.format}
Length: ${selected.length}
Tone: ${selected.tone}

STRUCTURE FOR EACH MESSAGE:
1. Open with tactical empathy — show you understand their specific world as a ${offer.niche} business
2. Label their likely problem — name what they are probably experiencing
3. Accusation audit — pre-empt their resistance to being contacted
4. Reference you have built something specific for their type of business (do not describe it)
5. No-oriented CTA — soft ask for a 10-minute demo using a no-oriented question

CRITICAL RULES:
- The prospect is the hero. The sender is the guide.
- Never mention price, features, or the service name directly
- Every message must feel like it came from someone who genuinely understands their business
- No two messages should have the same opening
- No exclamation marks
- No "I hope this message finds you well" or any filler opener
- No "transform", "unlock", "game-changer", "revolutionary" or hype words
- ${selected.extra}

${selectedChannel === "email" ? 'Return JSON with subject_line and message_text for each message. Subject line must also use a no-oriented or curiosity-gap approach — never a salesy subject line.' : 'Return JSON with message_text only for each message.'}

Return this exact JSON:
{
  "messages": [
    {
      ${selectedChannel === "email" ? '"subject_line": "subject line here",' : ''}
      "message_text": "full message here"
    }
  ]
}`

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
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: userMessage
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

    // Update niche_user_state to mark outreach as generated
    // First find niche_id from niche name
    const { data: nicheRecord } = await supabase
      .from("niches")
      .select("id")
      .ilike("niche_name", offer.niche || "")
      .maybeSingle()

    if (nicheRecord) {
      await supabase
        .from("niche_user_state")
        .upsert({
          user_id: user.id,
          niche_id: nicheRecord.id,
          outreach_generated: true,
          outreach_generated_at: new Date().toISOString(),
          stage: "demo"
        }, { onConflict: "user_id,niche_id" })
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
