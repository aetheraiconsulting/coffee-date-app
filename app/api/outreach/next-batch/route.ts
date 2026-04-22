import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"

type Channel = "linkedin" | "instagram" | "email"

// Smart next-batch generation. This route looks at which previously-sent messages
// got replies (winners) and which got no reply (losers), and asks Claude to
// generate the next 20 with the winning patterns baked in. When no reply data
// is available yet it falls back to fresh angles different from a first batch.
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

    const { channel } = (await request.json()) as { channel: Channel }
    if (!channel) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 })
    }

    // Two-step offer lookup — matches the rest of the outreach pipeline.
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
      return NextResponse.json({ error: "No active offer" }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Missing API key" }, { status: 500 })
    }

    // Winners — up to 5 messages that got replies
    const { data: repliedMessages } = await supabase
      .from("outreach_messages")
      .select("id, message_text, note, subject_line")
      .eq("user_id", user.id)
      .eq("channel", channel)
      .eq("offer_id", offer.id)
      .eq("status", "replied")
      .limit(5)

    // Losers — up to 5 messages that were sent but got no reply
    const { data: noReplyMessages } = await supabase
      .from("outreach_messages")
      .select("id, message_text")
      .eq("user_id", user.id)
      .eq("channel", channel)
      .eq("offer_id", offer.id)
      .eq("status", "no_reply")
      .limit(5)

    const hasReplyData = (repliedMessages?.length || 0) > 0

    const systemPrompt = `You are a sales copywriter optimising cold outreach based on what works.
You use 3C Storytelling, Chris Voss tactical empathy, and SPIN selling.
Keep tone casual, direct, operator-grade. No em dashes. No AI openers.
Return valid JSON only.`

    const userPrompt = `Generate the next batch of 20 ${channel} outreach messages for this offer.

Offer:
Service: ${offer.service_name}
Niche: ${offer.niche}
Outcome: ${offer.outcome_statement}

${
  hasReplyData
    ? `
These messages got REPLIES (do more like this):
${repliedMessages!
        .map((m, i) => `${i + 1}. "${m.message_text}"`)
        .join("\n")}

Analyze what made these work - the opening, the angle, the pain point, the closing question - and create 20 new messages that follow the same patterns with different specific hooks.
`
    : `
No reply data yet from previous batch. Generate 20 new messages with fresh angles and different hooks than a first batch would have used.
`
}

${
  noReplyMessages?.length
    ? `
These messages got NO REPLY (avoid this pattern):
${noReplyMessages
        .slice(0, 3)
        .map((m, i) => `${i + 1}. "${m.message_text}"`)
        .join("\n")}
`
    : ""
}

Return 20 new messages in JSON:
{
  "messages": [
    {
      "message_text": "the message",
      ${channel === "email" ? '"subject_line": "the subject",' : ""}
      "angle": "what angle this takes",
      "learning_applied": "what you learned from the reply data that informed this message"
    }
  ]
}`

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
      return NextResponse.json({ error: "Failed to generate next batch" }, { status: 500 })
    }

    const data = await response.json()
    const text = data.content[0].text.replace(/```json|```/g, "").trim()

    let parsed: {
      messages: Array<{
        message_text: string
        subject_line?: string
        angle?: string
        learning_applied?: string
      }>
    }
    try {
      parsed = JSON.parse(text)
    } catch (parseError) {
      console.error("Failed to parse Claude response:", text)
      return NextResponse.json({ error: "Failed to parse generated messages" }, { status: 500 })
    }

    const messagesToInsert = parsed.messages.map((m) => ({
      user_id: user.id,
      offer_id: offer.id,
      channel,
      message_text: m.message_text,
      subject_line: m.subject_line || null,
      status: "draft",
      note: m.angle || null,
    }))

    const { error: insertError } = await supabase
      .from("outreach_messages")
      .insert(messagesToInsert)

    if (insertError) {
      console.error("Failed to insert next batch:", insertError)
      return NextResponse.json({ error: "Failed to save messages" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: parsed.messages.length,
      learning_applied: hasReplyData,
      replied_count: repliedMessages?.length || 0,
    })
  } catch (error: any) {
    console.error("Outreach next-batch error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
