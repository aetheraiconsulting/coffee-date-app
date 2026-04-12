"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { UserState, MissionState } from "@/lib/getUserState"

interface StateContextType {
  state: UserState | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  refreshState: () => Promise<void> // Alias for refetch
}

const StateContext = createContext<StateContextType | undefined>(undefined)

export function StateProvider({ 
  children, 
  initialState 
}: { 
  children: ReactNode
  initialState?: UserState | null 
}) {
  const [state, setState] = useState<UserState | null>(initialState || null)
  const [loading, setLoading] = useState(!initialState)
  const [error, setError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/state")
      if (!response.ok) {
        throw new Error("Failed to fetch state")
      }
      const data = await response.json()
      setState(data.state)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialState) {
      fetchState()
    }
  }, [fetchState, initialState])

  return (
    <StateContext.Provider value={{ state, loading, error, refetch: fetchState, refreshState: fetchState }}>
      {children}
    </StateContext.Provider>
  )
}

export function useUserState() {
  const context = useContext(StateContext)
  if (context === undefined) {
    throw new Error("useUserState must be used within a StateProvider")
  }
  return context
}

// Helper hook for getting mission-specific data
export function useMissionData() {
  const { state, loading } = useUserState()

  if (!state) {
    return {
      loading,
      mission: null,
    }
  }

  const getMissionData = () => {
    switch (state.missionState) {
      // PROGRESSION STATES
      case "no_niche":
        return {
          mission: "Choose Your Target Niche",
          subtext: "We'll show you the best opportunities",
          why: "A focused niche converts 3x better. This decision shapes all your messaging.",
          cta: "Pick Your Niche",
          href: "/revival/opportunities",
          timeEstimate: "~10 minutes",
          progress: null,
        }
      case "no_offer":
        return {
          mission: "Build Your Offer",
          subtext: "Create the pitch that gets replies",
          why: "Your offer is what makes them say yes. Without it, outreach falls flat.",
          cta: "Build Offer",
          href: "/offer/builder",
          timeEstimate: "~15 minutes",
          progress: null,
        }
      case "no_outreach":
        return {
          mission: "Send Your First 20 Messages",
          subtext: "We'll generate your messages. You just click send.",
          why: "This is the step that creates your first replies. Without this, nothing moves.",
          cta: "Send Messages",
          href: "/revival",
          timeEstimate: "~15 minutes",
          progress: {
            current: state.outreachCount,
            target: 20,
            label: "messages sent",
          },
        }
      case "replies_received":
        return {
          mission: "Book Your First Call",
          subtext: `You have ${state.activeConversationsCount} active conversation${state.activeConversationsCount !== 1 ? "s" : ""} waiting`,
          why: "Replies without calls don't close deals. This is where revenue starts.",
          cta: "View Conversations",
          href: "/revival",
          timeEstimate: "~10 minutes",
          progress: {
            current: state.repliesCount,
            target: state.repliesCount,
            label: "replies received",
          },
        }
      case "call_booked":
        return {
          mission: "Run Your First Demo",
          subtext: `You have ${state.callsCount} call${state.callsCount !== 1 ? "s" : ""} booked. Time to close.`,
          why: "The demo is where deals happen. Show them the value, ask for the close.",
          cta: "Prepare Demo",
          href: "/demo",
          timeEstimate: "~30 minutes",
          progress: {
            current: state.callsCount,
            target: state.callsCount,
            label: "calls booked",
          },
        }
      case "call_completed":
        return {
          mission: "Send Your Proposal",
          subtext: "You've done the demo. Now close the deal.",
          why: "Proposals that go out within 24 hours close 3x more often.",
          cta: "Create Proposal",
          href: "/pipeline",
          timeEstimate: "~20 minutes",
          progress: null,
        }
      case "proposal_sent":
        return {
          mission: "Follow Up on Your Proposal",
          subtext: "Your proposal is out. Time to close.",
          why: "Most deals close after the first follow-up. Don't leave money on the table.",
          cta: "View Pipeline",
          href: "/pipeline",
          timeEstimate: "~10 minutes",
          progress: null,
        }
      
      // STALL STATES
      case "stall_no_replies":
        return {
          mission: "Improve Your Messaging",
          subtext: "You've sent messages but haven't gotten replies yet",
          why: "Let's review your offer and messaging to increase your reply rate.",
          cta: "Review Messages",
          href: "/revival",
          timeEstimate: "~15 minutes",
          progress: {
            current: state.outreachCount,
            target: 20,
            label: "messages sent (no replies)",
          },
        }
      case "stall_low_volume":
        return {
          mission: "Send More Messages",
          subtext: `You've only sent ${state.outreachCount} messages. Most replies come after 20.`,
          why: "Volume matters. The more conversations you start, the more replies you'll get.",
          cta: "Continue Outreach",
          href: "/revival",
          timeEstimate: "~15 minutes",
          progress: {
            current: state.outreachCount,
            target: 20,
            label: "messages sent",
          },
        }
      case "stall_thread_cold":
        return {
          mission: "Re-engage Cold Threads",
          subtext: "Some conversations have gone quiet",
          why: "A well-timed follow-up can revive a dead thread. Don't give up yet.",
          cta: "View Conversations",
          href: "/revival",
          timeEstimate: "~10 minutes",
          progress: null,
        }
      case "stall_call_noshow":
        return {
          mission: "Reschedule Your Call",
          subtext: "Your scheduled call didn't happen",
          why: "No-shows happen. A quick reschedule message often gets them back.",
          cta: "Follow Up",
          href: "/pipeline",
          timeEstimate: "~5 minutes",
          progress: null,
        }
      case "stall_proposal_ghosted":
        return {
          mission: "Follow Up on Proposal",
          subtext: "Your proposal hasn't gotten a response yet",
          why: "Proposals need follow-up. A gentle nudge often closes the deal.",
          cta: "Send Follow-up",
          href: "/pipeline",
          timeEstimate: "~5 minutes",
          progress: null,
        }
      case "stall_no_outreach_started":
        return {
          mission: "Start Your Outreach",
          subtext: "You've been preparing but haven't started yet",
          why: "Preparation is good, but action is better. Time to send your first message.",
          cta: "Start Outreach",
          href: "/revival",
          timeEstimate: "~15 minutes",
          progress: null,
        }
      
      default:
        return {
          mission: "Continue Your Journey",
          subtext: "Keep making progress",
          why: "Every step brings you closer to your first client.",
          cta: "View Dashboard",
          href: "/dashboard",
          timeEstimate: "~5 minutes",
          progress: null,
        }
    }
  }

  return {
    loading,
    mission: getMissionData(),
    state,
  }
}
