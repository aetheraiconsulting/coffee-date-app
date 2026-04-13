import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { nanoid } from "nanoid"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { audit_id, teaser_content } = body

  if (!audit_id) {
    return NextResponse.json({ error: "audit_id required" }, { status: 400 })
  }

  // Verify ownership
  const { data: audit, error: fetchError } = await supabase
    .from("audits")
    .select("id, share_token")
    .eq("id", audit_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (fetchError || !audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  }

  // Generate token if not exists
  const shareToken = audit.share_token || nanoid(12)

  const { error: updateError } = await supabase
    .from("audits")
    .update({
      share_token: shareToken,
      teaser_content: teaser_content || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", audit_id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to generate share link" }, { status: 500 })
  }

  // Fetch user's subdomain for custom link
  const { data: profile } = await supabase
    .from("profiles")
    .select("subdomain")
    .eq("id", user.id)
    .maybeSingle()

  const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || "aetherrevive.com"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${mainDomain}`

  // Use subdomain if available, otherwise fall back to main domain
  const baseUrl = profile?.subdomain
    ? `https://${profile.subdomain}.${mainDomain}`
    : appUrl

  const shareUrl = `${baseUrl}/audit/${shareToken}`

  return NextResponse.json({ share_token: shareToken, share_url: shareUrl })
}
