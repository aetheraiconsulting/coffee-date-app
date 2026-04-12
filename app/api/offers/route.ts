import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { headline, subheadline, problem, solution, proof, cta } = body

    // Validate required fields
    if (!headline || !problem || !solution || !cta) {
      return NextResponse.json(
        { error: "Missing required fields: headline, problem, solution, cta" },
        { status: 400 }
      )
    }

    // Insert offer into offers table
    const { data: offer, error: insertError } = await supabase
      .from("offers")
      .insert({
        user_id: user.id,
        headline,
        subheadline: subheadline || null,
        problem,
        solution,
        proof: proof || null,
        cta,
      })
      .select("id")
      .single()

    if (insertError) {
      console.error("Error inserting offer:", insertError)
      return NextResponse.json({ error: "Failed to create offer" }, { status: 500 })
    }

    // Update profiles.offer_id with the new offer ID
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ offer_id: offer.id })
      .eq("id", user.id)

    if (updateError) {
      console.error("Error updating profile offer_id:", updateError)
      return NextResponse.json({ error: "Failed to link offer to profile" }, { status: 500 })
    }

    return NextResponse.json({ success: true, offerId: offer.id })
  } catch (error) {
    console.error("Error in POST /api/offers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch user's current offer
  const { data: profile } = await supabase
    .from("profiles")
    .select("offer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.offer_id) {
    return NextResponse.json({ offer: null })
  }

  const { data: offer, error } = await supabase
    .from("offers")
    .select("*")
    .eq("id", profile.offer_id)
    .single()

  if (error) {
    return NextResponse.json({ error: "Failed to fetch offer" }, { status: 500 })
  }

  return NextResponse.json({ offer })
}
