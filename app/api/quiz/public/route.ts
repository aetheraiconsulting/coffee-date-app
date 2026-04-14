import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const subdomain = searchParams.get("subdomain")

  if (!code && !subdomain) {
    return NextResponse.json({ error: "Missing code or subdomain" }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find user by code or subdomain
  let profile = null
  if (code) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, quiz_share_code")
      .eq("quiz_share_code", code)
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
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
  }

  // Get user's default quiz or first published quiz
  const { data: quiz } = await supabase
    .from("quiz_templates")
    .select("id, title, description, questions, cta_text, cta_url, brand_color, logo_url, is_published")
    .eq("user_id", profile.id)
    .eq("is_published", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: "No published quiz found" }, { status: 404 })
  }

  // Get branding
  const { data: branding } = await supabase
    .from("user_branding")
    .select("logo_url, company_name, brand_colour, calendar_link")
    .eq("user_id", profile.id)
    .maybeSingle()

  // Merge branding - quiz settings override user branding
  const finalBranding = {
    logo_url: quiz.logo_url || branding?.logo_url,
    company_name: branding?.company_name,
    brand_colour: quiz.brand_color || branding?.brand_colour,
    calendar_link: branding?.calendar_link
  }

  return NextResponse.json({
    user_id: profile.id,
    quiz_id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questions: quiz.questions || [],
    cta_text: quiz.cta_text,
    cta_url: quiz.cta_url || branding?.calendar_link,
    branding: finalBranding
  })
}
