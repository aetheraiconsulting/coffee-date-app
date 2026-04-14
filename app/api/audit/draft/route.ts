import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { token, audit_id, responses, prospect_name, prospect_email } = await request.json()

  // Accept either token or audit_id
  let auditQuery = supabase.from("audits").select("id")

  if (audit_id) {
    auditQuery = auditQuery.eq("id", audit_id)
  } else if (token) {
    auditQuery = auditQuery.eq("share_token", token)
  } else {
    return NextResponse.json({ error: "Missing audit_id or token" }, { status: 400 })
  }

  const { data: audit, error: fetchError } = await auditQuery.maybeSingle()

  if (fetchError || !audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  }

  const answeredCount = Object.values(responses || {}).filter(v => v && String(v).trim()).length
  const completion = Math.round((answeredCount / 30) * 100)

  const updateData: Record<string, unknown> = {
    draft_responses: responses,
    completion_percentage: completion,
    updated_at: new Date().toISOString(),
  }

  if (prospect_name) updateData.prospect_name = prospect_name
  if (prospect_email) updateData.prospect_email = prospect_email

  const { error } = await supabase
    .from("audits")
    .update(updateData)
    .eq("id", audit.id)

  if (error) {
    console.error("Error saving draft:", error)
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
