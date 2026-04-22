import { createClient } from "@/lib/supabase/server"
import { detectStalls, type Stall } from "@/lib/detectStalls"

export type { Stall } from "@/lib/detectStalls"

// "sprint" = first 14 days — countdown framing + single focus on landing the
// first client. "growth" = day 15+ — directives adapt to client count rather
// than day count.
export type SprintMode = "sprint" | "growth"

// Lightweight shape of a recent client surfaced to Mission Control for the
// higher-client-count prompt variants.
export interface RecentClient {
  id: string
  name: string
  niche: string | null
  onboarded_at: string | null
  types: ("won" | "onboarded")[]
}

// Access level drives the feature-gating UI. "full" = normal app; "grace" = trial
// just ended but within the 48h soft window (or protected by an active proposal);
// "limited" = read-only mode, cannot create new content.
export type AccessLevel = "full" | "grace" | "limited"

// Progression states (7)
export type ProgressionState =
  | "no_niche"
  | "no_offer"
  | "no_outreach"
  | "replies_received"
  | "call_booked"
  | "call_completed"
  | "proposal_sent"

// Stall states (6)
export type StallState =
  | "stall_no_replies"
  | "stall_thread_cold"
  | "stall_call_noshow"
  | "stall_proposal_ghosted"
  | "stall_no_outreach_started"
  | "stall_low_volume"

export type MissionState = ProgressionState | StallState

export interface UserState {
  // Counts
  ghlCount: number
  nichesCount: number
  favouritesCount: number
  outreachCount: number
  repliesCount: number
  callsCount: number
  proposalsCount: number
  winsCount: number
  clientsOnboardedCount: number
  conversationsCount: number
  activeConversationsCount: number

  // Computed state
  missionState: MissionState
  dayInSprint: number
  sprintStartDate: string | null

  // User info
  userId: string
  email: string
  fullName: string | null

  // Subscription
  subscriptionStatus: string | null
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  promoCodeUsed: string | null

  // Feature gating
  accessLevel: AccessLevel
  gracePeriodEndsAt: string | null

  // Phase 4B — lifecycle expansion
  mode: SprintMode
  daysSinceStart: number
  clientCount: number
  stalls: Stall[]
  recentClients: RecentClient[]
}

export async function getUserState(): Promise<UserState | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch all data in parallel for performance
  const [
    { data: profile },
    { data: ghlConnections },
    { data: nichesData },
    { data: outreachMessagesData },
    { count: replyCount },
    { data: proposalsData },
    { count: sentProposalCount },
    { data: conversations },
    { count: callScriptCount },
    { count: completedCallCount },
    { count: clientsOnboardedCountRaw },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, email, sprint_start_date, offer_id, subscription_status, trial_ends_at, subscription_ends_at, promo_code_used").eq("id", user.id).maybeSingle(),
    supabase.from("ghl_connections").select("id").eq("user_id", user.id),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("outreach_messages").select("id, status").eq("user_id", user.id),
    supabase.from("reply_threads").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("proposals").select("id, sent, deal_status").eq("user_id", user.id),
    supabase.from("proposals").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("sent", true),
    supabase.from("revival_conversations").select("id, status").eq("user_id", user.id),
    supabase.from("call_scripts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("call_scripts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("call_completed", true),
    supabase.from("niche_user_state").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("client_onboarded", true),
  ])

  // Calculate counts
  const ghlCount = ghlConnections?.length || 0
  const nichesCount = nichesData?.length || 0
  const favouritesCount = nichesData?.filter((n) => n.is_favourite)?.length || 0
  const outreachCount = outreachMessagesData?.filter((m) => m.status === "sent")?.length || 0
  const repliesCount = replyCount ?? 0
  const callsCount = completedCallCount ?? 0 // Only count completed calls to match Pipeline page
  const proposalsCount = proposalsData?.length || 0
  const winsCount = proposalsData?.filter((p) => p.deal_status === "won")?.length || 0 // Count won deals from proposals to match Pipeline page
  const clientsOnboardedCount = clientsOnboardedCountRaw ?? 0
  const conversationsCount = conversations?.length || 0
  const activeConversationsCount = conversations?.filter((c) => c.status === "active")?.length || 0

  // Check if user has created an offer by checking profiles.offer_id
  const hasOffer = profile?.offer_id != null
  
  // Completed calls from call_scripts table (call_completed = true)
  const completedCalls = completedCallCount ?? 0
  const sentProposals = sentProposalCount ?? 0
  const closedProposals = proposalsData?.filter((p) => p.deal_status === "won" || p.deal_status === "lost")?.length || 0

  // Determine mission state based on funnel progression + stall detection
  const getMissionState = (): MissionState => {
    // PROGRESSION STATES (in order of funnel)
    if (favouritesCount === 0) return "no_niche"
    if (!hasOffer) return "no_offer"
    if (outreachCount === 0) return "no_outreach"
    
    // STALL: Sent messages but no replies after threshold
    if (outreachCount > 0 && repliesCount === 0) {
      // If they've sent < 20 messages, it's low volume stall
      if (outreachCount < 20) return "stall_low_volume"
      // Otherwise they've sent enough but no replies
      return "stall_no_replies"
    }
    
    // Have replies, need to book calls (no call scripts generated yet)
    if (repliesCount > 0 && callsCount === 0) return "replies_received"
    
    // Have call scripts generated but none completed
    if (callsCount > 0 && completedCalls === 0) return "call_booked"
    
    // Completed calls but no proposals sent
    if (completedCalls > 0 && sentProposals === 0) return "call_completed"
    
    // Proposal sent, waiting for close
    if (sentProposals > 0 && closedProposals === 0) return "proposal_sent"
    
    // Default: proposal sent (they've completed the funnel)
    return "proposal_sent"
  }

  // Calculate day in sprint. `daysSinceStart` is the uncapped elapsed-days
  // counter we use to decide sprint vs growth mode; `dayInSprint` stays capped
  // at 14 for the legacy countdown UI.
  const sprintStartDate = profile?.sprint_start_date || null
  let daysSinceStart = 0
  let dayInSprint = 1
  if (sprintStartDate) {
    const startDate = new Date(sprintStartDate)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - startDate.getTime())
    daysSinceStart = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    dayInSprint = Math.min(daysSinceStart + 1, 14)
  }

  // Phase 4B — sprint vs growth mode + unified client count. A single niche
  // can be both "won" and "onboarded", so we take the larger of the two
  // counts as a conservative upper bound of distinct clients.
  const mode: SprintMode = daysSinceStart >= 14 ? "growth" : "sprint"
  const wonProposalsCount = proposalsData?.filter((p) => p.deal_status === "won")?.length || 0
  const clientCount = Math.max(wonProposalsCount, clientsOnboardedCount)

  // Only fetch the recent-clients list when it'll actually be used by Mission
  // Control (growth mode with >=1 client). Keeps the common sprint-mode path
  // fast and avoids an extra join for new users.
  let recentClients: RecentClient[] = []
  if (clientCount > 0) {
    const { data: onboardedRows } = await supabase
      .from("niche_user_state")
      .select("id, niche_id, client_onboarded_at, niches(niche_name)")
      .eq("user_id", user.id)
      .eq("client_onboarded", true)
      .order("updated_at", { ascending: false })
      .limit(5)

    recentClients = (onboardedRows || []).map((row) => ({
      id: row.id,
      name: ((row.niches as any)?.niche_name as string) || "Client",
      niche: ((row.niches as any)?.niche_name as string) || null,
      onboarded_at: row.client_onboarded_at ?? null,
      types: ["onboarded"],
    }))
  }

  // Run stall detection last so the rest of state resolves even if this fails.
  let stalls: Stall[] = []
  try {
    stalls = await detectStalls(user.id)
  } catch (err) {
    console.log("[v0] detectStalls failed:", (err as Error).message)
  }

  // Feature gating — compute accessLevel + grace-period end timestamp. Active
  // subscribers, students, and promo users always get full access. Trial users
  // flip through "full" → "grace" (48h after trial ends, or indefinitely while
  // they have an active unresolved proposal) → "limited". Explicitly cancelled
  // or flagged statuses go straight to "limited".
  const status = profile?.subscription_status ?? null
  const trialEndsAtRaw = profile?.trial_ends_at ?? null
  const trialEndsAtDate = trialEndsAtRaw ? new Date(trialEndsAtRaw) : null
  const now = new Date()

  let accessLevel: AccessLevel = "full"
  let gracePeriodEndsAt: string | null = null

  if (status === "active" || status === "admin" || status === "student" || profile?.promo_code_used) {
    accessLevel = "full"
  } else if (status === "trial") {
    if (trialEndsAtDate && now > trialEndsAtDate) {
      const graceEnd = new Date(trialEndsAtDate.getTime() + 48 * 60 * 60 * 1000)
      gracePeriodEndsAt = graceEnd.toISOString()

      if (now <= graceEnd) {
        accessLevel = "grace"
      } else {
        // Active-proposal protection — if they've sent a proposal that hasn't
        // been closed (won/lost) yet we keep them in grace so the deal can
        // close without the gate killing momentum.
        const { data: activeProposals } = await supabase
          .from("proposals")
          .select("id")
          .eq("user_id", user.id)
          .eq("sent", true)
          .eq("deal_status", "pending")
          .limit(1)

        accessLevel = activeProposals && activeProposals.length > 0 ? "grace" : "limited"
      }
    } else {
      accessLevel = "full"
    }
  } else if (status === "limited" || status === "cancelled") {
    accessLevel = "limited"
  }

  return {
    ghlCount,
    nichesCount,
    favouritesCount,
    outreachCount,
    repliesCount,
    callsCount,
    proposalsCount,
    winsCount,
    clientsOnboardedCount,
    conversationsCount,
    activeConversationsCount,
    missionState: getMissionState(),
    dayInSprint,
    sprintStartDate,
    userId: user.id,
    email: user.email || "",
    fullName: profile?.full_name || null,
    subscriptionStatus: status,
    trialEndsAt: trialEndsAtRaw,
    subscriptionEndsAt: profile?.subscription_ends_at ?? null,
    promoCodeUsed: profile?.promo_code_used ?? null,
    accessLevel,
    gracePeriodEndsAt,
    mode,
    daysSinceStart,
    clientCount,
    stalls,
    recentClients,
  }
}
