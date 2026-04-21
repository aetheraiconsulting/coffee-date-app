import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { AccessLevel } from "@/lib/getUserState"

export type AccessCheckResult =
  | { allowed: true; accessLevel: AccessLevel; reason?: never }
  | { allowed: false; accessLevel: AccessLevel; reason: string }

/**
 * Server-side gate for feature-gated API routes.
 *
 * Returns `{ allowed: true }` when the caller can generate new content and
 * `{ allowed: false, reason }` when they cannot. Pair with
 * `subscriptionGateResponse()` to short-circuit a route with a 402 response.
 *
 * Mirrors the access-level logic in `getUserState` so the client and server
 * agree on who can do what:
 *   - active / student / promo_code_used  → full
 *   - trial before trial_ends_at           → full
 *   - trial within 48h of trial_ends_at    → grace (allowed unless opted out)
 *   - trial past grace + active proposal   → grace (allowed unless opted out)
 *   - trial past grace, nothing pending    → limited (blocked)
 *   - limited / cancelled                  → limited (blocked)
 */
export async function checkAccess(allowInGrace = true): Promise<AccessCheckResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, accessLevel: "limited", reason: "unauthorized" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, promo_code_used")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile) {
    return { allowed: false, accessLevel: "limited", reason: "no_profile" }
  }

  if (
    profile.subscription_status === "active" ||
    profile.subscription_status === "student" ||
    profile.promo_code_used
  ) {
    return { allowed: true, accessLevel: "full" }
  }

  if (profile.subscription_status === "trial") {
    const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null
    const now = new Date()

    if (trialEndsAt && now > trialEndsAt) {
      const graceEnd = new Date(trialEndsAt.getTime() + 48 * 60 * 60 * 1000)

      if (now <= graceEnd) {
        return allowInGrace
          ? { allowed: true, accessLevel: "grace" }
          : { allowed: false, accessLevel: "grace", reason: "grace_blocked" }
      }

      // Active-proposal protection
      const { data: activeProposals } = await supabase
        .from("proposals")
        .select("id")
        .eq("user_id", user.id)
        .eq("sent", true)
        .eq("deal_status", "pending")
        .limit(1)

      if (activeProposals && activeProposals.length > 0) {
        return allowInGrace
          ? { allowed: true, accessLevel: "grace" }
          : { allowed: false, accessLevel: "grace", reason: "grace_blocked" }
      }

      return { allowed: false, accessLevel: "limited", reason: "trial_expired" }
    }

    return { allowed: true, accessLevel: "full" }
  }

  if (profile.subscription_status === "limited" || profile.subscription_status === "cancelled") {
    return { allowed: false, accessLevel: "limited", reason: "subscription_lapsed" }
  }

  return { allowed: true, accessLevel: "full" }
}

/**
 * Convert a negative `checkAccess` result into a standard 402 Payment Required
 * JSON response. Returns `null` when the caller is allowed so routes can use
 * a single branch:
 *
 *     const access = await checkAccess()
 *     const gate = subscriptionGateResponse(access)
 *     if (gate) return gate
 */
export function subscriptionGateResponse(access: AccessCheckResult) {
  if (access.allowed) return null

  if (access.reason === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    {
      error: "subscription_required",
      reason: access.reason,
      accessLevel: access.accessLevel,
    },
    { status: 402 },
  )
}
