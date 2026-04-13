import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  // Fetch all data in parallel
  const [
    { data: profile },
    { data: offer },
    { data: nichesData },
    { data: outreachMessagesData },
    { count: replyCount },
    { count: callScriptCount },
  ] = await Promise.all([
    supabase.from("profiles").select("sprint_start_date, full_name, offer_id").eq("id", user.id).single(),
    supabase.from("offers").select("service_name, niche, pricing_model").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("outreach_messages").select("id, status").eq("user_id", user.id),
    supabase.from("reply_threads").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("call_scripts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
  ])

  const favouritesCount = nichesData?.filter((n) => n.is_favourite)?.length || 0
  const sentCount = outreachMessagesData?.filter((m) => m.status === "sent")?.length || 0
  const replyCountNum = replyCount ?? 0
  const callCount = callScriptCount ?? 0
  const hasOffer = profile?.offer_id != null

  // Determine state
  let state = "no_niche"
  if (favouritesCount === 0) state = "no_niche"
  else if (!hasOffer) state = "no_offer"
  else if (sentCount === 0) state = "no_outreach"
  else if (replyCountNum > 0 && callCount === 0) state = "replies_received"
  else if (callCount > 0) state = "call_booked"
  else state = "no_outreach"

  // Calculate day in sprint
  const sprintStart = profile?.sprint_start_date 
    ? new Date(profile.sprint_start_date) 
    : new Date()
  const dayInSprint = Math.min(
    Math.floor((Date.now() - sprintStart.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    14
  )

  // Determine pace
  const expectedSentByNow = dayInSprint * 2
  const pace = sentCount === 0 && dayInSprint > 2 
    ? "behind" 
    : sentCount >= expectedSentByNow 
    ? "on_track" 
    : "slightly_behind"

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: `You write Mission Control directives for Aether Revive — an AI client acquisition system used by young entrepreneurs trying to land their first AI client. 

Write in second person, direct, peer-to-peer tone. Never corporate. Never soft. Never generic.
Reference their specific data — offer name, niche, numbers, day count.
Match tone to pace: on_track = encouraging, slightly_behind = urgent, behind = direct intervention.
No exclamation marks. No hype words. Maximum 3 sentences.
Return valid JSON only.`,
      messages: [{
        role: "user",
        content: `Write a Mission Control directive for this user:

Current state: ${state}
Day in sprint: ${dayInSprint} of 14
Pace: ${pace}
Offer name: ${offer?.service_name || "not built yet"}
Niche: ${offer?.niche || "not selected yet"}
Messages sent: ${sentCount}
Replies received: ${replyCountNum}
Calls booked: ${callCount}

Return this exact JSON:
{
  "headline": "3-6 word action directive e.g. Send your first 20 messages",
  "subtext": "1-2 sentences that are specific to their data and situation — reference their offer name or niche if available",
  "cta_label": "3-4 word button label",
  "cta_href": "the correct page to send them to based on their state",
  "time_estimate": "e.g. ~15 minutes or ~2 minutes",
  "urgency_level": "low or medium or high"
}`
      }]
    })
  })

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to generate mission" }, { status: 500 })
  }

  const data = await response.json()
  const text = data.content[0].text.replace(/```json|```/g, "").trim()
  const mission = JSON.parse(text)

  return NextResponse.json({
    ...mission,
    state,
    dayInSprint,
    pace,
    sentCount,
    replyCount: replyCountNum,
    callCount,
  })
}
