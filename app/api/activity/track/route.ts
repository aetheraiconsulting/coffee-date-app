import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { trackActivity, type ActivityType } from "@/lib/trackActivity"

/**
 * Thin wrapper so client code (e.g. the niche favourite star) can record
 * activity without duplicating the profile-update logic. Authenticated users
 * only — the user id comes from the session, never the request body, so you
 * can't bump someone else's last_activity_at.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let type: ActivityType = "niche_favourited"
  try {
    const body = await request.json()
    if (body?.type) type = body.type as ActivityType
  } catch {
    // Missing / malformed body is fine — default to niche_favourited.
  }

  await trackActivity(user.id, type)
  return NextResponse.json({ ok: true })
}
