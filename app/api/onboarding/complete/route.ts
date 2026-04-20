import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      has_completed_onboarding: true,
      sprint_start_date: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (error) {
    console.error("[v0] Failed to complete onboarding:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
