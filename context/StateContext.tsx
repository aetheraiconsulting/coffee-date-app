"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { UserState, MissionState } from "@/lib/getUserState"

interface StateContextType {
  state: UserState | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
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
    <StateContext.Provider value={{ state, loading, error, refetch: fetchState }}>
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
      case "no_ghl":
        return {
          mission: "Connect Your GHL Account",
          subtext: "We'll pull in your contacts automatically",
          why: "This is the step that unlocks everything. Without this, you have no leads to work with.",
          cta: "Connect Now",
          href: "/revival/connect",
          timeEstimate: "~5 minutes",
          progress: null,
        }
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
      case "messages_sent_no_replies":
        return {
          mission: "Follow Up With Your Leads",
          subtext: "Your messages are out there. Now follow up to get replies.",
          why: "Follow-ups double your reply rate. Most leads respond on the 2nd or 3rd touch.",
          cta: "Send Follow-ups",
          href: "/revival",
          timeEstimate: "~10 minutes",
          progress: {
            current: state.outreachCount,
            target: 20,
            label: "leads contacted",
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
      default:
        return {
          mission: "Close Your First Client",
          subtext: "You're in the final stretch. Send the proposal.",
          why: "Everything you've done leads here. Focus on delivering value and asking for the close.",
          cta: "View Pipeline",
          href: "/pipeline",
          timeEstimate: "~15 minutes",
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
