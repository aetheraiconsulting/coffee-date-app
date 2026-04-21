import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"

// Mission Control directive generator. Adapts tone, focus, and schema based on
// whether the user is still in the 14-day sprint or in growth/delivery mode
// (past day 14), and how many clients they've already landed.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const access = await checkAccess()
  const gate = subscriptionGateResponse(access)
  if (gate) return gate

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 })
  }

  // Fetch all data in parallel.
  const [
    { data: profile },
    { data: offer },
    { data: nichesData },
    { data: outreachMessagesData },
    { count: replyCount },
    { count: callScriptCount },
    { count: wonProposalsCount },
    { count: onboardedCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("sprint_start_date, full_name, offer_id, created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("offers")
      .select("service_name, niche, pricing_model")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("outreach_messages").select("id, status").eq("user_id", user.id),
    supabase.from("reply_threads").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("call_scripts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase
      .from("proposals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("deal_status", "won"),
    supabase
      .from("niche_user_state")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("client_onboarded", true),
  ])

  const favouritesCount = nichesData?.filter((n) => n.is_favourite)?.length || 0
  const sentCount = outreachMessagesData?.filter((m) => m.status === "sent")?.length || 0
  const replyCountNum = replyCount ?? 0
  const callCount = callScriptCount ?? 0
  const hasOffer = profile?.offer_id != null

  // Mode + client count.
  const sprintStartRaw = profile?.sprint_start_date || profile?.created_at
  const sprintStart = sprintStartRaw ? new Date(sprintStartRaw) : new Date()
  const daysSinceStart = Math.floor((Date.now() - sprintStart.getTime()) / (1000 * 60 * 60 * 24))
  const dayInSprint = Math.min(daysSinceStart + 1, 14)
  const mode: "sprint" | "growth" = daysSinceStart >= 14 ? "growth" : "sprint"
  const clientCount = Math.max(wonProposalsCount ?? 0, onboardedCount ?? 0)

  // Determine progression state (sprint mode only uses this).
  let state = "no_niche"
  if (favouritesCount === 0) state = "no_niche"
  else if (!hasOffer) state = "no_offer"
  else if (sentCount === 0) state = "no_outreach"
  else if (replyCountNum > 0 && callCount === 0) state = "replies_received"
  else if (callCount > 0) state = "call_booked"
  else state = "no_outreach"

  // Pace (sprint mode only).
  const expectedSentByNow = dayInSprint * 2
  const pace =
    sentCount === 0 && dayInSprint > 2
      ? "behind"
      : sentCount >= expectedSentByNow
        ? "on_track"
        : "slightly_behind"

  // Recent clients for higher-client-count prompt variants.
  let recentClientsForPrompt: Array<{ name: string; niche: string | null; onboarded_at: string | null }> = []
  if (clientCount > 0) {
    const { data: recentClients } = await supabase
      .from("niche_user_state")
      .select("id, updated_at, client_onboarded_at, niches(niche_name)")
      .eq("user_id", user.id)
      .eq("client_onboarded", true)
      .order("updated_at", { ascending: false })
      .limit(5)

    recentClientsForPrompt = (recentClients || []).map((row) => ({
      name: ((row.niches as any)?.niche_name as string) || "Client",
      niche: ((row.niches as any)?.niche_name as string) || null,
      onboarded_at: row.client_onboarded_at ?? null,
    }))
  }

  // System prompt — different behaviour per mode × client count.
  const systemPrompt = `You write Mission Control directives for Aether Revive — an AI client acquisition system used by young entrepreneurs landing their first AI clients.

Write in second person, direct, peer-to-peer tone. Never corporate. Never soft. Never generic. Reference the user's specific data — offer name, niche, numbers. No exclamation marks. No hype words. Each directive field is maximum 2 sentences.

MODE: ${mode === "sprint" ? `SPRINT MODE — Day ${dayInSprint} of 14 countdown` : "GROWTH MODE — past initial sprint"}
CLIENT COUNT: ${clientCount}

Adapt directive based on mode and client count:

SPRINT MODE (days 1-14):
- Emphasise urgency and day-specific action
- All focus on landing the first client
- Use countdown language like "5 days left" or "halfway point"
- Fill "headline" + "subtext" only; leave prospecting_action and client_check_in as empty strings

GROWTH MODE, 0 clients:
- No countdown — day number is irrelevant
- Focus on breaking through the stuck point — identify what's blocking the first close
- Suggest one specific next action for the furthest-along niche
- Fill "headline" + "subtext"; leave prospecting_action and client_check_in empty

GROWTH MODE, 1 client:
- Briefly acknowledge the first win if it's recent
- Push for the second client using what worked on the first
- Reference the winning pattern in the subtext
- Fill "headline" + "subtext"; leave prospecting_action and client_check_in empty

GROWTH MODE, 2-3 clients:
- Balance prospecting and delivery
- Headline is a split-focus directive ("Balance new deals and client check-ins")
- "prospecting_action" = one sentence on the next prospecting move
- "client_check_in" = one sentence naming a specific client to check in with (from the list below)

GROWTH MODE, 4+ clients:
- Lead with delivery — reference a specific client by name
- "client_check_in" takes priority and names a specific client
- "prospecting_action" is secondary — one sentence
- "headline" leads with the delivery framing

Always return valid JSON only — no prose outside the JSON.`

  const userPrompt = `Write a Mission Control directive for this user:

Mode: ${mode}
${mode === "sprint" ? `Day in sprint: ${dayInSprint} of 14\nPace: ${pace}` : ""}
Client count: ${clientCount}
Current state: ${state}
Offer name: ${offer?.service_name || "not built yet"}
Niche: ${offer?.niche || "not selected yet"}
Messages sent: ${sentCount}
Replies received: ${replyCountNum}
Calls booked: ${callCount}
${recentClientsForPrompt.length > 0 ? `Recent clients: ${recentClientsForPrompt.map((c) => c.name).join(", ")}` : ""}

Return this exact JSON:
{
  "headline": "3-6 word action directive",
  "subtext": "1-2 sentences specific to their data and situation — reference offer name, niche, or client name when relevant",
  "prospecting_action": "For 2-3 or 4+ clients only: one sentence on next prospecting move. Empty string otherwise.",
  "client_check_in": "For 2-3 or 4+ clients only: one sentence on which client to check in with and why. Empty string otherwise.",
  "cta_label": "3-4 word button label",
  "cta_href": "the correct page to send them to — /clients for delivery-focused, /outreach for prospecting, /revival/opportunities for niche selection, /offer/builder for offer building, /pipeline for proposal follow-up",
  "time_estimate": "e.g. ~15 minutes or ~2 minutes",
  "urgency_level": "low or medium or high"
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
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to generate mission" }, { status: 500 })
  }

  const data = await response.json()
  const text = data.content[0].text.replace(/```json|```/g, "").trim()
  const mission = JSON.parse(text)

  return NextResponse.json({
    ...mission,
    // Ensure the split-view fields are always present (empty string fallback)
    // so the UI doesn't have to guard against undefined.
    prospecting_action: mission.prospecting_action ?? "",
    client_check_in: mission.client_check_in ?? "",
    state,
    dayInSprint,
    daysSinceStart,
    mode,
    clientCount,
    pace,
    sentCount,
    replyCount: replyCountNum,
    callCount,
  })
}
