import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { token, audit_id } = await request.json()

  // Accept either token or audit_id
  let audit = null
  if (audit_id) {
    const { data } = await supabase.from("audits").select("*").eq("id", audit_id).maybeSingle()
    audit = data
  } else if (token) {
    const { data } = await supabase.from("audits").select("*").eq("share_token", token).maybeSingle()
    audit = data
  }

  if (!audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  }

  if (!audit.responses || Object.keys(audit.responses).length === 0) {
    return NextResponse.json({ error: "No responses to analyze" }, { status: 400 })
  }

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // Return a generic teaser if no API key
    return NextResponse.json({
      teaser: "Based on your responses, we've identified several key opportunities to leverage AI in your business. Your consultant will review these insights and discuss specific recommendations during your call."
    })
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    const responseSummary = Object.entries(audit.responses)
      .filter(([, value]) => value && String(value).trim())
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Based on this AI readiness audit, write a brief 2-3 sentence teaser that hints at the opportunities identified without giving away specific recommendations. Be encouraging and make them excited to discuss further.

Audit responses:
${responseSummary}

Write only the teaser paragraph, nothing else.`
        }
      ]
    })

    const teaser = message.content[0].type === "text" ? message.content[0].text : ""

    // Save teaser to audit
    await supabase
      .from("audits")
      .update({ teaser_content: teaser })
      .eq("id", audit.id)

    return NextResponse.json({ teaser })
  } catch (error) {
    console.error("Error generating teaser:", error)
    return NextResponse.json({
      teaser: "Based on your responses, we've identified several key opportunities to leverage AI in your business. Your consultant will review these insights and discuss specific recommendations during your call."
    })
  }
}
