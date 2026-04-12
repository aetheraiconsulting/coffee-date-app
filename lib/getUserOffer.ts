import { createClient } from "@/lib/supabase/server"

export interface Offer {
  id: string
  user_id: string
  niche: string
  industry: string
  service_name: string
  outcome_statement: string
  price_point: string
  guarantee: string
  confidence_score: number
  confidence_reason: string
  created_at: string
}

/**
 * Fetches the current user's offer from the database.
 * Returns null if no user is logged in or no offer exists.
 */
export async function getUserOffer(): Promise<Offer | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the user's profile to find their offer_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("offer_id")
    .eq("id", user.id)
    .single()

  if (!profile?.offer_id) {
    return null
  }

  // Fetch the offer
  const { data: offer } = await supabase
    .from("offers")
    .select("*")
    .eq("id", profile.offer_id)
    .single()

  return offer
}
