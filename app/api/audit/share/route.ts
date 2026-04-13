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

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://coffee-date-app.vercel.app"}/audit/${shareToken}`

  return NextResponse.json({ share_token: shareToken, share_url: shareUrl })
}
