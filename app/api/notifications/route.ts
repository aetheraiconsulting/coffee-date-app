import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// List the most recent 20 notifications for the authenticated user. The bell
// also displays an unread count, which is separately returned here so the UI
// can render both from a single round trip on first open.
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, action_href, related_id, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) throw error

    const unreadCount = (data || []).filter((n) => !n.read).length

    return NextResponse.json({ notifications: data || [], unreadCount })
  } catch (err) {
    console.log("[v0] GET /api/notifications error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 })
  }
}
