import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

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
