import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const systemPrompt = `You are the AI engine inside Aether Revive. Write the perfect response to a prospect reply using Chris Voss tactical empathy and the 3C Storytelling Framework. The prospect is the hero. You are the guide. The only goal is to book a 10-minute screen share demo call — NOT a discovery call, NOT a sales call. A demo call is low pressure: "I'll show you the system working on your type of business, takes 10 minutes, no commitment." Use labelling, tactical empathy, and no-oriented questions. Keep responses under 100 words. Calm, confident, never pushy. Return valid JSON only. No markdown. No explanation.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { outreach_message_id, prospect_reply } = await request.json()
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Missing API key" }, { status: 500 })

  const { data: message } = await supabase
    .from("outreach_messages")
    .select("*, offers(*)")
    .eq("id", outreach_message_id)
    .single()

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  const userMessage = `Write the ideal response to move this prospect toward booking a 10-minute demo call.

Original message sent:
${message.message_text}

Our service:
${message.offers?.service_name || "Our service"} — ${message.offers?.outcome_statement || "Helping businesses grow"}

Prospect replied:
${prospect_reply}

Goal: get them to agree to a 10-minute screen share where we show the AI system working on their type of business.

Apply these techniques:
- Label their response first e.g. "It sounds like..."
- Use tactical empathy — acknowledge their position before asking for anything
- End with a no-oriented question e.g. "Would it be crazy to take 10 minutes to see it?"
- Keep it under 100 words
- No pitch. No price. No pressure.

Return this exact JSON:
{
  "suggested_response": "the full response to send",
  "response_goal": "one sentence on what this response is trying to achieve"
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
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: userMessage
      }]
    })
  })

  const data = await response.json()
  const text = data.content[0].text.replace(/```json|```/g, "").trim()
  const result = JSON.parse(text)

  const { data: thread } = await supabase
    .from("reply_threads")
    .insert({
      user_id: user.id,
      outreach_message_id,
      prospect_reply,
      suggested_response: result.suggested_response,
      response_goal: result.response_goal,
    })
    .select()
    .single()

  await supabase
    .from("outreach_messages")
    .update({ status: "replied" })
    .eq("id", outreach_message_id)

  return NextResponse.json({
    suggested_response: result.suggested_response,
    response_goal: result.response_goal,
    thread_id: thread?.id
  })
}
