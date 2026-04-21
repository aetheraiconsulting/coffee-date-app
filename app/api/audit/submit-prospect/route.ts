import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { upsertProspect } from "@/lib/createProspect"
import { createNotification } from "@/lib/createNotification"

export async function POST(request: Request) {
  const { audit_id, responses } = await request.json()

  if (!audit_id) {
    return NextResponse.json({ error: "Missing audit_id" }, { status: 400 })
  }

  // Use service role client to bypass RLS for public audit submission
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase service role configuration")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)

  // Grab the audit owner and stored prospect identity before we update — we
  // need the owner's user_id to create the prospect row and notification, and
  // `prospect_name` / `prospect_email` are typically captured at draft time.
  const { data: audit } = await supabase
    .from("audits")
    .select("user_id, prospect_name, prospect_email")
    .eq("id", audit_id)
    .maybeSingle()

  const answeredCount = Object.values(responses || {}).filter(v => v && String(v).trim()).length
  const completion = Math.round((answeredCount / 30) * 100)

  const { error } = await supabase
    .from("audits")
    .update({
      responses,
      draft_responses: responses,
      completion_percentage: completion,
      status: "completed",
      prospect_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", audit_id)

  if (error) {
    console.error("Error submitting audit:", error)
    return NextResponse.json({ error: "Failed to submit audit" }, { status: 500 })
  }

  // Side-effects: create/merge prospect + notify the owner. Both are fire-
  // and-forget (the helpers swallow their own errors) so a transient failure
  // in either path can never block the prospect's submission from saving.
  if (audit?.user_id && audit?.prospect_email) {
    await upsertProspect({
      user_id: audit.user_id,
      email: audit.prospect_email,
      name: audit.prospect_name ?? null,
      source: "audit",
      source_id: audit_id,
      extraMetadata: { completion_percentage: completion },
    })

    await createNotification(
      {
        user_id: audit.user_id,
        type: "prospect_audit_completed",
        title: "Audit completed",
        body: `${audit.prospect_name || audit.prospect_email} finished your audit.`,
        action_href: `/audit/builder?id=${audit_id}`,
        related_id: audit_id,
      },
      { useServiceRole: true },
    )
  }

  return NextResponse.json({ success: true })
}
