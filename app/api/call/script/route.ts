import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkAccess, subscriptionGateResponse } from "@/lib/checkAccess"
import { trackActivity } from "@/lib/trackActivity"

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await checkAccess()
    const gate = subscriptionGateResponse(access)
    if (gate) return gate

    // Step 1: Try via profiles.offer_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("offer_id")
      .eq("id", user.id)
      .maybeSingle()

    let offer = null

    if (profile?.offer_id) {
      const { data } = await supabase
        .from("offers")
        .select("*")
        .eq("id", profile.offer_id)
        .maybeSingle()
      offer = data
    }

    // Step 2: Fallback to most recent active offer
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
      return NextResponse.json({ error: "No active offer found. Please create an offer first." }, { status: 400 })
    }

    // Check if script already exists
    const { data: existingScript } = await supabase
      .from("call_scripts")
      .select("*")
      .eq("user_id", user.id)
      .eq("offer_id", offer.id)
      .eq("call_completed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingScript) {
      return NextResponse.json({ script: existingScript })
    }

    // Get reply context if available
    const { data: recentReplies } = await supabase
      .from("reply_threads")
      .select("prospect_reply, suggested_response")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3)

    const repliesContext = recentReplies?.length
      ? `\n\nRecent prospect replies for context:\n${recentReplies.map(r => `- "${r.prospect_reply}"`).join("\n")}`
      : ""

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
        system: `You are an expert sales coach building call scripts for AI service consultants. 
You use the Chris Voss tactical empathy framework and SPIN selling methodology.
The goal of the call is NOT to close immediately — it is to run a 10-minute Coffee Date Demo and then move to a proposal.
Write in second person, direct and confident. No corporate language. No filler.
Return valid JSON only. No markdown. No explanation.`,
        messages: [
          {
            role: "user",
            content: `Build a call preparation script for this AI service consultant.

Their offer:
Service: ${offer.service_name}
Niche: ${offer.niche}
Outcome: ${offer.outcome_statement}
Pricing: ${offer.pricing_model} — ${offer.price_point}
Guarantee: ${offer.guarantee}
${repliesContext}

Return this exact JSON:
{
  "opening": "How to open the call — first 30 seconds. Warm, confident, sets the agenda. Reference the demo.",
  "qualification_questions": "3-4 SPIN questions to ask before the demo. Situation and Problem questions only. One at a time.",
  "demo_transition": "How to transition from questions into the Coffee Date Demo. Natural, low pressure.",
  "objection_responses": "Top 3 objections for this niche and how to handle each using Voss techniques.",
  "close_ask": "How to close after the demo — move toward proposal. No-oriented question format.",
  "pre_call_checklist": ["item 1", "item 2", "item 3", "item 4", "item 5"]
}`
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
        offer_id: offer.id,
        opening: scriptData.opening,
        qualification_questions: scriptData.qualification_questions,
        demo_transition: scriptData.demo_transition,
        objection_responses: scriptData.objection_responses,
        close_ask: scriptData.close_ask,
      })
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    // Re-engagement tracking: user has a call lined up.
    await trackActivity(user.id, "call_booked")

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
