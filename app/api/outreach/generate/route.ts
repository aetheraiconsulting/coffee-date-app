import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"

type Channel = "linkedin" | "instagram" | "email"

// Combined system prompt: operator-grade voice, 3C Storytelling (Stacey),
// Chris Voss tactical empathy, and SPIN (Situation + Problem focused).
// The model MUST return clean JSON with no markdown fences or commentary.
const systemPrompt = `You are a sales copywriter for AI service consultants.
You write cold outreach messages using:
- 3C Storytelling (Clarity, Connection, Conviction) — Adam Stacey's framework
- Chris Voss tactical empathy — open with "It sounds like..." style labels, use no-oriented questions
- SPIN Selling — focus on Situation and Problem questions, not Implication or Need-Payoff
- Casual, conversational tone — like a real human wrote it
- Short, direct, operator-grade voice

NEVER use:
- Em dashes
- AI-pattern openers ("I hope this finds you well", "I wanted to reach out")
- Corporate language ("leverage", "synergies", "streamline")
- Exclamation marks
- Hype words ("amazing", "incredible", "game-changing")

Return valid JSON only, no markdown, no explanation.`

function buildUserPrompt(
  channel: Channel,
  offer: any,
  user_context: string | undefined,
) {
  const channelLines: Record<Channel, string> = {
    linkedin:
      "LinkedIn: 100-150 words. Professional but casual. Reference something observable about their business.",
    instagram:
      "Instagram DM: 60-80 words. Very casual, direct. Feels like a message between two humans.",
    email:
      "Email: 150-200 words plus subject line. Subject line under 50 characters, no clickbait, states the specific opportunity.",
  }

  return `Generate 20 ${channel} outreach messages for this offer.

Offer:
Service: ${offer.service_name}
Niche: ${offer.niche}
Outcome: ${offer.outcome_statement}
Pricing: ${offer.pricing_model} - ${offer.price_point}

${user_context ? `Additional context from the user:\n${user_context}\n` : ""}

Channel-specific requirements:
${channelLines[channel]}

Every message MUST:
- Open with a Voss label ("It sounds like..." or "Most ${offer.niche} I speak to...")
- Name a specific pain point relevant to ${offer.niche}
- Invite to a 10-minute demo call (NOT a pitch, NOT a discovery call - a demo)
- End with a no-oriented question ("Would it be crazy to...", "Would it be worth...")
- Vary opening labels, pain points, and closing questions across the 20 messages
- Each message should feel distinct - different angles, different hooks

Return this exact JSON:
{
  "messages": [
    {
      "message_text": "the message body",
      ${channel === "email" ? '"subject_line": "the subject line",' : ""}
      "angle": "one-line description of the angle this message takes (e.g. 'dormant database size', 'competitor speed')"
    }
  ]
}

Return exactly 20 items in the messages array.`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await checkAccess()
    const gate = subscriptionGateResponse(access)
    if (gate) return gate

    // Accept user_context (new, preferred) and fall back to prospect_context for
    // any older callers. Channel is always required.
    const body = await request.json()
    const selectedChannel: Channel = (body?.channel as Channel) || "linkedin"
    const user_context: string | undefined =
      body?.user_context ?? body?.prospect_context ?? undefined

    // Two-step offer lookup: profiles.offer_id first, then most-recent active offer.
    const { data: profile } = await supabase
      .from("profiles")
      .select("offer_id")
      .eq("id", user.id)
      .maybeSingle()

    let offer: any = null

    if (profile?.offer_id) {
      const { data } = await supabase
        .from("offers")
        .select("*")
        .eq("id", profile.offer_id)
        .maybeSingle()
      offer = data
    }

    if (!offer) {
      const { data } = await supabase
        .from("offers")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      offer = data
    }

    if (!offer) {
      return NextResponse.json({ error: "No active offer found" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 })
    }

    const userPrompt = buildUserPrompt(selectedChannel, offer, user_context)

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
        messages: [{ role: "user", content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Anthropic API error:", error)
      return NextResponse.json({ error: "Failed to generate messages" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content[0].text.replace(/```json|```/g, "").trim()

    let result: { messages: Array<{ message_text: string; subject_line?: string; angle?: string }> }
    try {
      result = JSON.parse(text)
    } catch (parseError) {
      console.error("Failed to parse Claude response:", text)
      return NextResponse.json({ error: "Failed to parse generated messages" }, { status: 500 })
    }

    // Persist each message as a draft. The `angle` returned by Claude is stored
    // on the `note` column so the user can see at a glance what approach each
    // message takes (and so next-batch learning has something to reference).
    const messagesToInsert = result.messages.map((m) => ({
      user_id: user.id,
      offer_id: offer.id,
      message_text: m.message_text,
      subject_line: m.subject_line || null,
      status: "draft",
      channel: selectedChannel,
      note: m.angle || null,
    }))

    const { data: insertedMessages, error: insertError } = await supabase
      .from("outreach_messages")
      .insert(messagesToInsert)
      .select()

    if (insertError) {
      console.error("Failed to insert messages:", insertError)
      return NextResponse.json({ error: "Failed to save messages" }, { status: 500 })
    }

    // Mark outreach as generated for this niche so the pipeline + opportunities
    // pages can progress the user's stage without manual confirmation.
    const { data: nicheRecord } = await supabase
      .from("niches")
      .select("id")
      .ilike("niche_name", offer.niche || "")
      .maybeSingle()

    if (nicheRecord) {
      await supabase.from("niche_user_state").upsert(
        {
          user_id: user.id,
          niche_id: nicheRecord.id,
          outreach_generated: true,
          outreach_generated_at: new Date().toISOString(),
          stage: "demo",
        },
        { onConflict: "user_id,niche_id" },
      )
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
