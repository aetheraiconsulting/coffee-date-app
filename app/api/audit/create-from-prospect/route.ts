import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { user_id, prospect_name, prospect_email } = await request.json()

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 })
  }

  // Use service role client to bypass RLS for public audit creation
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase service role configuration")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey)

  // Verify user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user_id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Create new audit record owned by the user
  const { data: audit, error } = await supabase
    .from("audits")
    .insert({
      user_id: user_id,
      name: prospect_name || "Prospect Audit",
      prospect_name,
      prospect_email,
      status: "in_progress",
      completion_percentage: 0,
      responses: {},
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating audit:", error)
    return NextResponse.json({ error: "Failed to create audit" }, { status: 500 })
  }

  return NextResponse.json({ audit_id: audit.id })
}
