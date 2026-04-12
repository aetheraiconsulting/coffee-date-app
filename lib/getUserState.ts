import { createClient } from "@/lib/supabase/server"

export type MissionState =
  | "no_ghl"
  | "no_niche"
  | "no_outreach"
  | "messages_sent_no_replies"
  | "replies_received"
  | "call_booked"
  | "call_completed"

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
    supabase.from("profiles").select("full_name, email, sprint_start_date").eq("id", user.id).single(),
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

  // Determine mission state based on funnel progression
  const getMissionState = (): MissionState => {
    if (ghlCount === 0) return "no_ghl"
    if (favouritesCount === 0) return "no_niche"
    if (outreachCount === 0) return "no_outreach"
    if (repliesCount === 0) return "messages_sent_no_replies"
    if (callsCount === 0) return "replies_received"
    
    const completedCalls = callsData?.filter((c) => c.status === "completed")?.length || 0
    if (completedCalls === 0) return "call_booked"
    
    return "call_completed"
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
