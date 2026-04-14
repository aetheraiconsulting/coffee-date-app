import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration")
  }

  return createServiceClient(supabaseUrl, serviceRoleKey)
}

// GET: Fetch user info by code or subdomain (for initial form load)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const subdomain = searchParams.get("subdomain")

  if (!code && !subdomain) {
    return NextResponse.json({ error: "Missing code or subdomain" }, { status: 400 })
  }

  try {
    const supabase = getServiceClient()

    let profile = null
    if (code) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, audit_share_code")
        .eq("audit_share_code", code)
        .maybeSingle()
      profile = data
    } else if (subdomain) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, subdomain")
        .eq("subdomain", subdomain)
        .maybeSingle()
      profile = data
    }

    if (!profile) {
      return NextResponse.json({ error: "Invalid audit link" }, { status: 404 })
    }

    // Fetch branding
    const { data: branding } = await supabase
      .from("user_branding")
      .select("logo_url, company_name, brand_colour, calendar_link")
      .eq("user_id", profile.id)
      .maybeSingle()

    return NextResponse.json({
      user_id: profile.id,
      branding
    })
  } catch (error) {
    console.error("Error fetching user data:", error)
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }
}

// POST: Generate teaser after audit submission
export async function POST(request: Request) {
  const { token, audit_id } = await request.json()

  try {
    const supabase = getServiceClient()

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
