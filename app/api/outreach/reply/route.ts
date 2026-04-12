import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
      system: "You are the AI engine inside Aether Revive. Write the perfect response to a prospect reply. The only goal is to book a discovery call. Under 100 words. Direct, warm, confident. Never pushy. Return valid JSON only. No markdown. No explanation.",
      messages: [{
        role: "user",
        content: `Write the ideal response to this prospect reply.\n\nOriginal message sent:\n${message.message_text}\n\nOur service:\n${message.offers?.service_name || "Our service"} — ${message.offers?.outcome_statement || "Helping businesses grow"}\n\nProspect replied:\n${prospect_reply}\n\nReturn this exact JSON:\n{\n  "suggested_response": "the full response to send",\n  "response_goal": "one sentence on what this achieves"\n}`
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
