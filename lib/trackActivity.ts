import { createClient } from "@/lib/supabase/server"

/**
 * Activity types we track across the app. Stored only in logs — the profile row
 * itself just records the timestamp. Any meaningful user action should call
 * trackActivity so the re-engagement cron doesn't wake us up the next morning.
 */
export type ActivityType =
  | "offer_created"
  | "outreach_sent"
  | "reply_received"
  | "call_booked"
  | "proposal_sent"
  | "audit_sent"
  | "demo_completed"
  | "niche_favourited"

/**
 * Record that the user has done something. This:
 *   1. Updates profiles.last_activity_at = now()
 *   2. Clears any active re-engagement state so the next cron pass doesn't
 *      keep chasing someone who has already come back
 *
 * Safe to call on every request — a single UPDATE, no read-modify-write cycle.
 * Errors are swallowed and logged; activity tracking must never break a user
 * action.
 */
export async function trackActivity(userId: string, type: ActivityType) {
  if (!userId) return

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("profiles")
      .update({
        last_activity_at: new Date().toISOString(),
        // Reset re-engagement ladder — user is active again.
        reengagement_stage: null,
        last_reengagement_sent_at: null,
      })
      .eq("id", userId)

    if (error) {
      console.error("[trackActivity] update failed", { userId, type, error })
    }
  } catch (err) {
    console.error("[trackActivity] threw", { userId, type, err })
  }
}
