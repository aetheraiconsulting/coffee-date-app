import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { token, prospect_name, prospect_email, responses } = body

  if (!token || !prospect_name || !prospect_email || !responses) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Find audit by token
  const { data: audit, error: fetchError } = await supabase
    .from("audits")
    .select("id, prospect_submitted_at")
    .eq("share_token", token)
    .maybeSingle()

  if (fetchError || !audit) {
    return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  }

  if (audit.prospect_submitted_at) {
    return NextResponse.json({ error: "Audit already submitted" }, { status: 400 })
  }

  // Calculate completion percentage
  const answeredCount = Object.values(responses).filter((v) => v && String(v).trim()).length
  const totalQuestions = 30 // Total questions in the audit
  const completionPercentage = Math.round((answeredCount / totalQuestions) * 100)

  // Update audit with prospect responses
  const { error: updateError } = await supabase
    .from("audits")
    .update({
      prospect_name,
      prospect_email,
      responses,
      completion_percentage: completionPercentage,
      status: completionPercentage === 100 ? "completed" : "in_progress",
      prospect_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", audit.id)

  if (updateError) {
    return NextResponse.json({ error: "Failed to submit audit" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
