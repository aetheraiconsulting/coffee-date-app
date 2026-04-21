import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// POST body: { id?: string }
// - With `id`: marks a single notification as read. Used when the user clicks
//   an individual item in the bell dropdown.
// - Without `id`: marks all of the user's unread notifications as read. Used
//   by the "Mark all read" action.
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const id: string | undefined = body?.id

    let query = supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)

    if (id) query = query.eq("id", id)

    const { error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.log("[v0] POST /api/notifications/mark-read error:", (err as Error).message)
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
  }
}
