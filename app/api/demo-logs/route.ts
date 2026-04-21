import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { trackActivity } from "@/lib/trackActivity"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const androidId = searchParams.get("androidId")
    const type = searchParams.get("type")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    let query = supabase
      .from("demo_logs")
      .select(`
        *,
        androids (id, name),
        niches (id, niche_name)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (androidId) {
      query = query.eq("android_id", androidId)
    }

    if (type) {
      query = query.eq("type", type)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching demo logs:", error)
      return NextResponse.json({ error: "Failed to fetch demo logs" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in demo logs GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { androidId, type, nicheId, nicheName, sessionId } = body

    if (!androidId || !type) {
      return NextResponse.json({ error: "androidId and type are required" }, { status: 400 })
    }

    if (!["test", "client"].includes(type)) {
      return NextResponse.json({ error: "type must be 'test' or 'client'" }, { status: 400 })
    }

    // Create the demo log
    const { data: demoLog, error: logError } = await supabase
      .from("demo_logs")
      .insert({
        user_id: user.id,
        android_id: androidId,
        type,
        niche_id: nicheId || null,
        niche_name: nicheName || null,
        session_id: sessionId || null,
      })
      .select()
      .single()

    if (logError) {
      console.error("Error creating demo log:", logError)
      return NextResponse.json({ error: "Failed to create demo log" }, { status: 500 })
    }

    if (type === "client" && nicheId) {
      const now = new Date().toISOString()

      const { data: existingState } = await supabase
        .from("niche_user_state")
        .select("id")
        .eq("niche_id", nicheId)
        .eq("user_id", user.id)
        .single()

      const updateData = {
        coffee_date_completed: true,
        coffee_date_completed_at: now, // Added timestamp
        status: "Coffee Date Demo",
        updated_at: now,
      }

      if (existingState) {
        await supabase.from("niche_user_state").update(updateData).eq("id", existingState.id)
      } else {
        await supabase.from("niche_user_state").insert({
          niche_id: nicheId,
          user_id: user.id,
          ...updateData,
        })
      }
    }

    // Re-engagement tracking: user ran a demo, definitely active.
    await trackActivity(user.id, "demo_completed")

    return NextResponse.json({ success: true, demoLog })
  } catch (error) {
    console.error("Error in demo logs POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
