import { createClient } from "@/lib/supabase/server"

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
    { data: outreachData },
    { data: repliesData },
    { data: callsData },
    { data: proposalsData },
    { data: conversations },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, email, sprint_start_date, offer_id").eq("id", user.id).single(),
    supabase.from("ghl_connections").select("id").eq("user_id", user.id),
    supabase.from("niche_user_state").select("id, is_favourite, status").eq("user_id", user.id),
    supabase.from("outreach").select("id").eq("user_id", user.id),
    supabase.from("replies").select("id").eq("user_id", user.id),
    supabase.from("calls").select("id, status").eq("user_id", user.id),
    supabase.from("proposals").select("id, status").eq("user_id", user.id),
    supabase.from("revival_conversations").select("id, status").eq("user_id", user.id),
  ])

  // Calculate counts
  const ghlCount = ghlConnections?.length || 0
  const nichesCount = nichesData?.length || 0
  const favouritesCount = nichesData?.filter((n) => n.is_favourite)?.length || 0
  const outreachCount = outreachData?.length || 0
  const repliesCount = repliesData?.length || 0
  const callsCount = callsData?.length || 0
  const proposalsCount = proposalsData?.length || 0
  const winsCount = nichesData?.filter((n) => n.status === "Win")?.length || 0
  const conversationsCount = conversations?.length || 0
  const activeConversationsCount = conversations?.filter((c) => c.status === "active")?.length || 0

  // TODO: offer builder writes offer_id to profiles on completion
  // Check if user has created an offer by checking profiles.offer_id
  const hasOffer = profile?.offer_id != null

  // Calculate time-based stall conditions
  const now = new Date()
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Get latest outreach date for stall detection
  // Note: Would need to fetch created_at from outreach table for real stall detection
  
  // Completed calls and sent proposals
  const completedCalls = callsData?.filter((c) => c.status === "completed")?.length || 0
  const sentProposals = proposalsData?.filter((p) => p.status === "sent" || p.status === "pending")?.length || 0
  const closedProposals = proposalsData?.filter((p) => p.status === "won" || p.status === "lost")?.length || 0

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
    
    // Have replies, need to book calls
    if (repliesCount > 0 && callsCount === 0) return "replies_received"
    
    // Have calls booked but none completed
    if (callsCount > 0 && completedCalls === 0) return "call_booked"
    
    // Completed calls but no proposals sent
    if (completedCalls > 0 && sentProposals === 0) return "call_completed"
    
    // Proposal sent, waiting for close
    if (sentProposals > 0 && closedProposals === 0) return "proposal_sent"
    
    // Default: proposal sent (they've completed the funnel)
    return "proposal_sent"
  }

  // Calculate day in sprint
  const sprintStartDate = profile?.sprint_start_date || null
  let dayInSprint = 1
  if (sprintStartDate) {
    const startDate = new Date(sprintStartDate)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - startDate.getTime())
    dayInSprint = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 14)
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
    conversationsCount,
    activeConversationsCount,
    missionState: getMissionState(),
    dayInSprint,
    sprintStartDate,
    userId: user.id,
    email: user.email || "",
    fullName: profile?.full_name || null,
  }
}
