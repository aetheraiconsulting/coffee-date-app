import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { audit_id, responses } = await request.json()

  if (!audit_id) {
    return NextResponse.json({ error: "Missing audit_id" }, { status: 400 })
  }

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

  return NextResponse.json({ success: true })
}
