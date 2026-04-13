import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()

  // Fetch audit by share_token - no auth required
  const { data: audit, error } = await supabase
    .from("audits")
    .select("id, name, teaser_content, prospect_submitted_at, user_id")
    .eq("share_token", token)
    .maybeSingle()

  if (error || !audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  }

  // Get owner's branding
  const { data: branding } = await supabase
    .from("user_branding")
    .select("company_name, logo_url, brand_colour")
    .eq("user_id", audit.user_id)
    .maybeSingle()

  return NextResponse.json({
    id: audit.id,
    name: audit.name,
    teaser_content: audit.teaser_content,
    already_submitted: !!audit.prospect_submitted_at,
    branding: branding || null,
  })
}
