"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Star,
  ChevronDown,
  ChevronLeft,
  Flame,
  TrendingUp,
  Snowflake,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Users,
  Phone,
  Mail,
  Coffee,
  Trophy,
  Calculator,
  Minus,
  Plus,
  Loader2,
  Target,
  X,
  CheckCircle,
  ChevronRight,
  UserCheck,
  Lock,
  FileSpreadsheet,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter, usePathname } from "next/navigation"
// Phase 4F — shared pricing module. The recoverable-revenue card below now
// delegates its formula to calculateRecoverableRevenue() so every place in
// the product that computes operator earnings uses identical maths.
import { calculateRecoverableRevenue } from "@/lib/pricing/calculateRevenue"
import { parsePricePoint } from "@/lib/pricing"

/**
 * RevenuePersister — tiny write-through helper that saves the computed
 * commission / retainer values to the previously-dead columns on
 * niche_user_state so other parts of the app (clients page, dashboard,
 * pipeline reports) can read them without re-running the maths.
 *
 * We deliberately debounce with a ref so identical result payloads don't
 * trigger repeated upserts as the parent re-renders. Rendering nothing —
 * this is an effect-only component.
 */
function RevenuePersister({
  nicheId,
  result,
  pricingModel,
  commissionPct,
}: {
  nicheId: string
  result: {
    recoverableRevenue: number
    operatorCommission: number | null
    commissionBasis: string | null
  }
  pricingModel: string | null
  commissionPct: number | null
}) {
  const supabase = createClient()
  const lastSavedRef = useRef<string>("")

  useEffect(() => {
    // Only persist once we have a non-zero calc — avoids writing zeroes
    // while the user is still typing into the AOV / database-size inputs.
    if (!nicheId || result.recoverableRevenue <= 0) return

    // Profit-share models can't give us a deterministic commission number,
    // so we fall back to a 15% planning estimate (midpoint of the 10-20%
    // band quoted in the UI note). Pay-per-lead / pay-per-conversation
    // use the exact computed value. Retainer writes null + active retainer.
    const profitSplitPotential =
      result.operatorCommission !== null
        ? result.operatorCommission
        : pricingModel === "50_profit_share" || pricingModel === "custom_profit_share"
          ? Math.round(result.recoverableRevenue * 0.15)
          : null

    const activeMonthlyRetainer =
      pricingModel === "retainer" && commissionPct && commissionPct > 0
        ? commissionPct
        : null

    const key = `${nicheId}:${profitSplitPotential}:${activeMonthlyRetainer}`
    if (lastSavedRef.current === key) return
    lastSavedRef.current = key

    const save = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from("niche_user_state").upsert(
        {
          user_id: user.id,
          niche_id: nicheId,
          profit_split_potential: profitSplitPotential,
          active_monthly_retainer: activeMonthlyRetainer,
        },
        { onConflict: "niche_id,user_id" },
      )
    }
    // Fire-and-forget — failure here must never break the UI.
    save().catch(() => {})
  }, [
    nicheId,
    result.recoverableRevenue,
    result.operatorCommission,
    pricingModel,
    commissionPct,
    supabase,
  ])

  return null
}

function EditableCounter({
  value,
  onChange,
  channelKey,
  isUpdating,
}: {
  value: number
  onChange: (channel: keyof OutreachChannels, newValue: number) => Promise<void>
  channelKey: keyof OutreachChannels
  isUpdating: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(value.toString())
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    const parsed = Number.parseInt(editValue, 10)
    const newValue = isNaN(parsed) || parsed < 0 ? 0 : parsed
    setIsEditing(false)
    if (newValue !== value) {
      await onChange(channelKey, newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave()
    } else if (e.key === "Escape") {
      setEditValue(value.toString())
      setIsEditing(false)
    }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-12 text-center font-semibold text-white bg-zinc-800 border border-zinc-600 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#00A8FF]"
        disabled={isUpdating}
      />
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      disabled={isUpdating}
      className="w-8 text-center font-semibold text-white hover:bg-white/10 rounded cursor-pointer transition-colors"
      title="Click to edit"
    >
      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : value}
    </button>
  )
}

// Pipeline stages: Research → Offer → Outreach → Demo → Revival
// Audit is a separate opportunity card, not a pipeline stage
const PIPELINE_STAGES = [
  { key: "research", label: "Research" },
  { key: "offer", label: "Offer" },
  { key: "outreach", label: "Outreach" },
  { key: "demo", label: "Demo" },
  { key: "revival", label: "Revival" },
]

// Legacy status mappings for backward compatibility
const STAGE_TO_DB_STATUS: Record<string, string> = {
  research: "Research",
  offer: "Offer",
  outreach: "Outreach",
  demo: "Demo",
  revival: "Revival",
}

const DB_STATUS_TO_STAGE: Record<string, string> = {
  Research: "research",
  Offer: "offer",
  Outreach: "outreach",
  Demo: "demo",
  Revival: "revival",
  // Legacy mappings
  Shortlisted: "offer",
  "Outreach in Progress": "outreach",
  "Coffee Date Demo": "demo",
  Win: "revival",
}

const STAGE_SCORES: Record<string, number> = {
  research: 10,
  offer: 25,
  outreach: 40,
  demo: 70,
  revival: 100,
}

// Define the structure for industry
type Industry = {
  id: string
  name: string
}

// Define the structure for outreach_channels (manual extras logged by user)
type OutreachChannels = {
  linkedin_messages?: number
  instagram_messages?: number
  facebook_dms?: number // legacy - no longer shown in UI
  cold_calls?: number
  emails?: number
  meetings_booked?: number
  objections?: string | null
}

// Define the structure for niche_user_state
type NicheUserState = {
  id: string
  niche_id: string
  user_id: string
  is_favourite: boolean
  status: string | null
  stage: string | null // New stage field: research, offer, outreach, demo, revival, audit
  notes: string | null
  expected_monthly_value: number | null
  research_notes: string | null
  aov_input: number | null
  database_size_input: number | null
  cpl_calculated: number | null
  cpa_calculated: number | null
  potential_retainer: number | null
  profit_split_potential: number | null
  customer_profile: {
    decision_maker?: string
    pain_points?: string
    gathering_places?: string
  } | null
  research_notes_added: boolean | null
  aov_calculator_completed: boolean | null
  customer_profile_generated: boolean | null
  messaging_scripts: any | null
  messaging_prepared: boolean | null
  outreach_start_date: string | null
  outreach_channels: OutreachChannels | null
  outreach_messages_sent: number
  outreach_notes: string | null
  demo_script_created: boolean | null
  demo_script: string | null
  coffee_date_completed: boolean | null
  coffee_date_completed_at?: string | null
  ghl_sub_account_id: string | null
  active_monthly_retainer: number | null
  monthly_profit_split: number | null
  target_monthly_recurring: number | null
  win_completed: boolean | null
  win_completed_at?: string | null
  win_type?: "revival" | "audit" | null
  revival_win_completed?: boolean | null
  audit_win_completed?: boolean | null
  updated_at?: string
  // New fields for pipeline
  why_this_works_content?: string | null
  offer_id?: string | null
  outreach_generated?: boolean | null
  outreach_generated_at?: string | null
  android_built?: boolean | null
  ghl_connected?: boolean | null
  audit_available?: boolean | null
  client_onboarded?: boolean | null
  client_onboarded_at?: string | null
  outreach_complete?: boolean | null
  outreach_complete_at?: string | null
  // Optional: best-effort marker when a proposal has been won against this niche
  // (populated from proposals.deal_status = 'won' in a future iteration)
  proposal_won?: boolean | null
  }

// Define the structure for a Niche
type Niche = {
  id: string
  niche_name: string
  industry_id: string | null
  scale: string | null
  database_size: string | null
  default_priority: number | null
  industry?: Industry
  user_state: NicheUserState | null
  // Temporary for modal filtering
  industry_name?: string
}

type AISuggestions = {
  topPriorityAction: string
  messageIdea: string
  risk: string
  opportunity: string
  suggestion: string
}

function getStageGating(userState: NicheUserState | null): {
  canMoveToShortlisted: boolean
  canMoveToOutreach: boolean
  canMoveToCoffeeDate: boolean
  canMoveToWin: boolean // This will be unused after the change, but kept for now for logic clarity before refactor
  shortlistedReason: string
  outreachReason: string
  coffeeDateReason: string
  winReason: string // This will be unused after the change
} {
  if (!userState) {
    return {
      canMoveToShortlisted: false,
      canMoveToOutreach: false,
      canMoveToCoffeeDate: false,
      canMoveToWin: false,
      shortlistedReason: "Complete Research tasks first",
      outreachReason: "Mark messaging as prepared to move to Outreach",
      coffeeDateReason: "Log at least one outreach activity to move forward",
      winReason: "Complete coffee date demo first",
    }
  }

  const researchComplete =
    userState.research_notes_added === true &&
    userState.customer_profile_generated === true &&
    userState.aov_calculator_completed === true

  const messagingComplete = userState.messaging_prepared === true

  const outreachComplete = (userState.outreach_messages_sent || 0) > 0

  const coffeeDateComplete = userState.coffee_date_completed === true

  return {
    canMoveToShortlisted: researchComplete,
    canMoveToOutreach: messagingComplete,
    canMoveToCoffeeDate: outreachComplete,
    canMoveToWin: coffeeDateComplete, // This field is still present but will not be used for direct stage progression
    shortlistedReason: researchComplete
      ? ""
      : "Add research notes, complete AOV calculator, and generate customer profile first",
    outreachReason: messagingComplete ? "" : "Mark messaging as prepared to move to Outreach",
    coffeeDateReason: outreachComplete ? "" : "Log at least one outreach activity to move forward",
    winReason: coffeeDateComplete ? "" : "Complete coffee date demo first", // This reason will not be directly displayed for stage gating
  }
}

// Single source of truth for deriving the current pipeline stage from a niche's state.
// Uses completion booleans (set by the various "Mark complete" actions throughout the app)
// rather than the legacy `status` text field, which is rarely kept in sync.
function deriveStage(userState: NicheUserState | null | undefined): string {
  if (!userState) return "research"
  // An explicit stage (set by progressToStage) wins when present
  if (userState.stage) return userState.stage
  if (userState.ghl_connected || userState.client_onboarded || userState.win_completed) return "revival"
  if (userState.coffee_date_completed) return "demo"
  if (userState.outreach_complete || userState.outreach_generated) return "outreach"
  if (userState.offer_id) return "offer"
  if (
    userState.research_notes_added &&
    userState.customer_profile_generated &&
    userState.aov_calculator_completed
  ) {
    return "offer"
  }
  return "research"
}

function calculatePipelineScore(userState: NicheUserState | null): {
  stageScore: number
  activityScore: number
  pipelineScore: number
} {
  if (!userState) {
    return { stageScore: 10, activityScore: 0, pipelineScore: 10 }
  }

  // Derive stage from completion flags so the score updates as the user progresses
  const stageId = deriveStage(userState)
  const stageScore = STAGE_SCORES[stageId] ?? 10

  const channels = userState.outreach_channels || {}
  const manualActivity =
    (channels.linkedin_messages || 0) +
    (channels.instagram_messages || 0) +
    (channels.facebook_dms || 0) +
    (channels.cold_calls || 0) +
    (channels.emails || 0) +
    (channels.meetings_booked || 0)

  // Use the auto-tracked count from the Outreach tool if available, otherwise manual
  const autoActivity = userState.outreach_messages_sent || 0
  const totalActivity = Math.max(manualActivity, autoActivity)

  const activityScore = Math.min(totalActivity * 5, 50)
  const pipelineScore = stageScore + activityScore

  return { stageScore, activityScore, pipelineScore }
}

function getPriorityTier(pipelineScore: number): "hot" | "warm" | "cold" {
  if (pipelineScore >= 70) return "hot"
  if (pipelineScore >= 40) return "warm"
  return "cold"
}

function getAutomationAlerts(
  userState: NicheUserState | null,
): { type: "warning" | "info" | "success"; message: string }[] {
  const alerts: { type: "warning" | "info" | "success"; message: string }[] = []

  if (!userState) return alerts

  const status = userState.status || "Research"
  const channels = userState.outreach_channels || {}
  const totalActivity =
    (channels.linkedin_messages || 0) +
    (channels.facebook_dms || 0) +
    (channels.cold_calls || 0) +
    (channels.emails || 0)

  if (userState.updated_at) {
    const lastUpdate = new Date(userState.updated_at)
    const daysSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))

    if (status === "Outreach in Progress" && daysSinceUpdate > 5) {
      alerts.push({ type: "warning", message: `No activity in ${daysSinceUpdate} days - lead going cold` })
    }
    if (status === "Coffee Date Demo" && daysSinceUpdate > 3) {
      alerts.push({ type: "warning", message: "Demo scheduled but no follow-up in 3+ days" })
    }
  }

  if (status === "Outreach in Progress" && totalActivity < 5) {
    alerts.push({ type: "info", message: "Low outreach activity - increase touchpoints" })
  }

  if (status === "Research" && userState.aov_calculator_completed && userState.customer_profile_generated) {
    alerts.push({ type: "info", message: "Research complete - ready to shortlist" })
  }

  if (totalActivity >= 15) {
    alerts.push({ type: "success", message: "Strong engagement - prioritize follow-ups" })
  }

  return alerts
}

export default function OpportunitiesPage() {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [industryMap, setIndustryMap] = useState<Map<string, Industry>>(new Map())
  const [allNiches, setAllNiches] = useState<Niche[]>([])
  const [filteredNiches, setFilteredNiches] = useState<Niche[]>([])
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null)
  // Mobile list/details toggle. Below `lg` we show EITHER the list or the
  // details panel — never both — because stacking them vertically on a 375px
  // screen produces a page thousands of pixels tall and an unusable scroll.
  const [mobileView, setMobileView] = useState<"list" | "details">("list")
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [industryFilter, setIndustryFilter] = useState<string>("all")
  
  // Reset selected niche when industry filter changes
  const handleIndustryChange = (value: string) => {
    setIndustryFilter(value)
    setSelectedNiche(null)
    setNicheState(undefined)
    setAiSuggestions(null)
    setWhyThisWorksContent(null)
  }
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState<string>("score")

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestions | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  
  // Why This Works state
  const [whyThisWorksContent, setWhyThisWorksContent] = useState<string | null>(null)
  const [loadingWhyThisWorks, setLoadingWhyThisWorks] = useState(false)
  
  // Fetched niche state - undefined means not yet fetched, null means no record exists
  const [nicheState, setNicheState] = useState<NicheUserState | null | undefined>(undefined)

  // Count of Androids the user has built that target the currently selected niche,
  // plus the id of the most-recently-created matching Android so we can deep-link
  // "Go to Coffee Date Demo" straight into that Android instead of the generic list.
  // We can't rely on `niche_user_state.android_built` (stale seed-only flag) and we
  // can't rely on the top-level `androids.niche` column alone because older inserts
  // only stored the niche inside the `business_context` JSONB — so we match on both.
  const [nicheAndroidCount, setNicheAndroidCount] = useState<number>(0)
  const [firstNicheAndroidId, setFirstNicheAndroidId] = useState<string | null>(null)

  // Auto-counts from outreach_messages table (LinkedIn, Instagram, Email) for the selected niche.
  // We track two numbers per channel: messages CREATED (all drafts + sent) and messages SENT.
  // Cold calls stay fully manual since they aren't tracked by the Outreach tool.
  type ChannelCounts = { created: number; sent: number }
  const [autoOutreachCounts, setAutoOutreachCounts] = useState<{
    linkedin: ChannelCounts
    instagram: ChannelCounts
    email: ChannelCounts
  }>({
    linkedin: { created: 0, sent: 0 },
    instagram: { created: 0, sent: 0 },
    email: { created: 0, sent: 0 },
  })

  // Collapsible sections state - all start false, auto-expand useEffect sets correct ones after nicheState loads
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    whyThisWorks: false,
    research: false,
    offer: false,
    outreach: false,
    outreachTracker: false,
    demo: false,
    revival: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Helper to get section status for dot color
  const getSectionStatus = (sectionStage: string): "completed" | "current" | "locked" => {
    const stages = ["research", "offer", "outreach", "demo", "revival"]
    // Use the derived stage so section dots progress as the user marks steps complete,
    // not just when the legacy `status` text field is manually changed.
    const currentIndex = stages.indexOf(deriveStage(nicheState))
    const sectionIndex = stages.indexOf(sectionStage)
    if (sectionIndex < currentIndex) return "completed"
    if (sectionIndex === currentIndex) return "current"
    return "locked"
  }

  // Helper to get stage index for comparison
  const getStageIndex = (stage: string) => {
    const index = PIPELINE_STAGES.findIndex(s => s.key === stage)
    return index >= 0 ? index : 0
  }

  const [savingField, setSavingField] = useState<string | null>(null)

  // AI-powered AOV estimates. Notes are keyed by niche id so switching niches
  // doesn't leak the wrong explanations onto a different niche's inputs.
  type AovEstimateNotes = {
    aov_notes: string
    database_size_low: number
    database_size_high: number
    database_size_notes: string
    dormant_percentage: number
    dormant_notes: string
    reactivation_rate: number
    reactivation_notes: string
  }
  const [fetchingEstimates, setFetchingEstimates] = useState(false)
  const [estimateNotesByNiche, setEstimateNotesByNiche] = useState<Record<string, AovEstimateNotes>>({})

  const { toast } = useToast()
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
// Active offer state - fetched directly from database
  const [activeOffer, setActiveOffer] = useState<{
    id: string
    service_name: string
    price_point: string
    pricing_model: string
    niche: string | null
  } | null>(null)
  const [offerLoading, setOfferLoading] = useState(true)
  
  // Check if active offer matches the selected niche
  const nicheMatches = activeOffer !== null && 
    selectedNiche !== null &&
    activeOffer.niche?.toLowerCase().trim() === selectedNiche.niche_name?.toLowerCase().trim()

  const [updatingChannel, setUpdatingChannel] = useState<string | null>(null)

  const [showCoffeeDateModal, setShowCoffeeDateModal] = useState(false)
  const [coffeeDateStep, setCoffeeDateStep] = useState<"type" | "niche">("type")
  const [coffeeDateType, setCoffeeDateType] = useState<"test" | "client" | null>(null)
  const [coffeeDateNicheSearch, setCoffeeDateNicheSearch] = useState("")

  const [showWinModal, setShowWinModal] = useState(false)
  const [winNicheSearch, setWinNicheSearch] = useState("")

  const fetchAiSuggestions = useCallback(async (niche: Niche) => {
    setLoadingSuggestions(true)
    try {
      const response = await fetch("/api/opportunities/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicheId: niche.id,
          nicheName: niche.niche_name,
          status: niche.user_state?.status || "Research",
          outreachChannels: niche.user_state?.outreach_channels,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        setAiSuggestions(data)
      }
    } catch (error) {
      console.error("Failed to fetch AI suggestions:", error)
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  // Fetch or generate Why This Works content - always clear first then reload
  const loadWhyThisWorks = useCallback(async (niche: Niche) => {
    // Always clear first to avoid showing stale content
    setWhyThisWorksContent(null)
    setLoadingWhyThisWorks(true)

    try {
      // Check cache in niche_user_state first via direct DB query
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setWhyThisWorksContent("Unable to load analysis - please sign in.")
        return
      }

      const { data: cachedState } = await supabase
        .from("niche_user_state")
        .select("why_this_works_content")
        .eq("user_id", user.id)
        .eq("niche_id", niche.id)
        .maybeSingle()

      if (cachedState?.why_this_works_content) {
        setWhyThisWorksContent(cachedState.why_this_works_content)
        return
      }

      // Generate new content via API if not cached
      const response = await fetch("/api/niches/why-this-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche_name: niche.niche_name,
          industry_name: niche.industry_name || niche.industry || "",
          niche_id: niche.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate")
      }

      const data = await response.json()
      setWhyThisWorksContent(data.content || "Unable to generate analysis for this niche.")
    } catch (error) {
      console.error("Failed to fetch Why This Works:", error)
      setWhyThisWorksContent("Unable to load analysis for this niche. Try selecting it again.")
    } finally {
      setLoadingWhyThisWorks(false)
    }
  }, [supabase])

  const loadIndustries = useCallback(async () => {
    const { data, error } = await supabase.from("industries").select("id, name").order("name")

    if (!error && data) {
      setIndustries(data)
      const map = new Map<string, Industry>()
      data.forEach((ind) => map.set(ind.id, ind))
      setIndustryMap(map)
    }
  }, [supabase])

  const loadNiches = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: niches, error } = await supabase
      .from("niches")
      .select(`id, niche_name, industry_id, scale, database_size, default_priority, industries (name)`)
      .order("niche_name")
      .limit(1000)

    if (error || !niches) {
      setLoading(false)
      return
    }

    const { data: userStates } = await supabase.from("niche_user_state").select("*").eq("user_id", user.id)

    const stateMap = new Map<string, NicheUserState>()
    userStates?.forEach((state) => stateMap.set(state.niche_id, state))

    // Map won proposals to their niches via the associated offer.
    // proposals -> offers.niche (string) -> niches.niche_name (string)
    const { data: wonProposals } = await supabase
      .from("proposals")
      .select("offer_id")
      .eq("user_id", user.id)
      .eq("deal_status", "won")

    const wonOfferIds = Array.from(
      new Set((wonProposals || []).map((p: any) => p.offer_id).filter(Boolean)),
    )

    const wonNicheNames = new Set<string>()
    if (wonOfferIds.length > 0) {
      const { data: wonOffers } = await supabase
        .from("offers")
        .select("niche")
        .in("id", wonOfferIds)
      wonOffers?.forEach((o: any) => {
        if (o?.niche) wonNicheNames.add(String(o.niche).toLowerCase().trim())
      })
    }

    const enrichedNiches: Niche[] = niches.map((niche) => {
      const baseState = stateMap.get(niche.id) || null
      const hasProposalWon = wonNicheNames.has(String(niche.niche_name).toLowerCase().trim())
      return {
        ...niche,
        // @ts-ignore
        industry_name: niche.industries?.name || "Unknown",
        user_state: baseState
          ? { ...baseState, proposal_won: hasProposalWon }
          : hasProposalWon
            ? ({ proposal_won: true } as NicheUserState)
            : null,
      }
    })

    setAllNiches(enrichedNiches)
    setLoading(false)
  }, [supabase])

  const loadData = useCallback(async () => {
    await loadIndustries()
    await loadNiches()
  }, [loadIndustries, loadNiches])

  useEffect(() => {
    loadData()
  }, [loadData])

// Fetch active offer - extracted as named function for reuse
  const fetchActiveOffer = async () => {
    setOfferLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setOfferLoading(false)
      return
    }
    
    const { data } = await supabase
      .from("offers")
      .select("id, service_name, price_point, pricing_model, niche")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
    
    setActiveOffer(data)
    setOfferLoading(false)
  }

  // Fetch active offer on mount
  useEffect(() => {
    fetchActiveOffer()
  }, [])

  // Refetch when page becomes visible (user returns from another tab/page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchActiveOffer()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Fetch auto-counts of outreach messages for the selected niche.
  // Messages are matched to a niche by: outreach_messages.offer_id -> offers.niche (text) == niche.niche_name.
  useEffect(() => {
    const emptyCounts = {
      linkedin: { created: 0, sent: 0 },
      instagram: { created: 0, sent: 0 },
      email: { created: 0, sent: 0 },
    }

    const fetchAutoCounts = async () => {
      if (!selectedNiche) {
        setAutoOutreachCounts(emptyCounts)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Find offers for this user that target this niche (case-insensitive match on niche name)
      const { data: offers } = await supabase
        .from("offers")
        .select("id, niche")
        .eq("user_id", user.id)

      const matchingOfferIds = (offers || [])
        .filter((o: any) =>
          o?.niche && String(o.niche).toLowerCase().trim() === String(selectedNiche.niche_name).toLowerCase().trim(),
        )
        .map((o: any) => o.id)

      if (matchingOfferIds.length === 0) {
        setAutoOutreachCounts(emptyCounts)
        return
      }

      // 2. Pull messages for those offers — we count CREATED (any row) and SENT
      // (status in 'sent' | 'replied' | 'no_reply'; i.e., anything that isn't still a 'draft').
      const { data: msgs } = await supabase
        .from("outreach_messages")
        .select("channel, status")
        .eq("user_id", user.id)
        .in("offer_id", matchingOfferIds)

      const counts = {
        linkedin: { created: 0, sent: 0 },
        instagram: { created: 0, sent: 0 },
        email: { created: 0, sent: 0 },
      }
      ;(msgs || []).forEach((m: any) => {
        const ch = String(m.channel || "").toLowerCase().trim()
        const status = String(m.status || "").toLowerCase().trim()
        const isSent = status === "sent" || status === "replied" || status === "no_reply"
        if (ch === "linkedin") {
          counts.linkedin.created++
          if (isSent) counts.linkedin.sent++
        } else if (ch === "instagram") {
          counts.instagram.created++
          if (isSent) counts.instagram.sent++
        } else if (ch === "email") {
          counts.email.created++
          if (isSent) counts.email.sent++
        }
      })
      setAutoOutreachCounts(counts)
    }

    fetchAutoCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNiche?.id, selectedNiche?.niche_name])

  // Fetch the Androids this user has built that target the selected niche.
  // Androids store their niche in any of: top-level `niche` column, or inside
  // `business_context.niche` / `business_context.serviceType` / `business_context.industry`.
  // We load all of the user's Androids and match on any of those fields (case-insensitive).
  // We also record the most-recent matching Android's id so the "Go to Coffee Date Demo"
  // button can deep-link directly into that Android.
  const fetchNicheAndroids = async () => {
    if (!selectedNiche) {
      setNicheAndroidCount(0)
      setFirstNicheAndroidId(null)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setNicheAndroidCount(0)
      setFirstNicheAndroidId(null)
      return
    }
    const { data: androids } = await supabase
      .from("androids")
      .select("id, niche, business_context, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    const target = String(selectedNiche.niche_name).toLowerCase().trim()
    const normalize = (v: any) =>
      typeof v === "string" ? v.toLowerCase().trim() : ""
    const matches = (androids || []).filter((a: any) => {
      const ctx = a?.business_context || {}
      return (
        normalize(a?.niche) === target ||
        normalize(ctx.niche) === target ||
        normalize(ctx.serviceType) === target ||
        normalize(ctx.industry) === target
      )
    })
    setNicheAndroidCount(matches.length)
    setFirstNicheAndroidId(matches[0]?.id ?? null)
  }

  useEffect(() => {
    fetchNicheAndroids()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNiche?.id, selectedNiche?.niche_name])

  // Refetch when window regains focus. This is the critical hook that picks up
  // `coffee_date_completed = true` and any newly-built Androids after the user
  // runs a demo or creates an Android in another tab.
  useEffect(() => {
    const handleFocus = () => {
      fetchActiveOffer()
      fetchNicheState()
      fetchNicheAndroids()
    }
    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNiche?.id, selectedNiche?.niche_name])

  // Refetch when pathname changes (immediate refresh on navigation back)
  useEffect(() => {
    fetchActiveOffer()
  }, [pathname])

  // Fetch niche_user_state — declared at component scope so we can call it from the
  // focus handler too (e.g. after a user runs a client demo in another tab).
  const fetchNicheState = async () => {
    if (!selectedNiche) {
      setNicheState(undefined)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setNicheState(null)
      return
    }

    const { data } = await supabase
      .from("niche_user_state")
      .select("*")
      .eq("user_id", user.id)
      .eq("niche_id", selectedNiche.id)
      .maybeSingle()

    // If no record exists, set to null (not undefined) - this means "research" stage
    setNicheState(data || null)
  }

  // Fetch niche_user_state when selectedNiche changes
  useEffect(() => {
    fetchNicheState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNiche?.id, supabase])

  useEffect(() => {
    if (selectedNiche) {
      fetchAiSuggestions(selectedNiche)
    } else {
      setAiSuggestions(null)
    }
  }, [selectedNiche, fetchAiSuggestions])

  // Load Why This Works when niche changes - using selectedNiche?.id as dependency
  useEffect(() => {
    if (selectedNiche) {
      loadWhyThisWorks(selectedNiche)
    } else {
      setWhyThisWorksContent(null)
    }
  }, [selectedNiche?.id, loadWhyThisWorks])

  // Auto-expand sections based on current stage when niche state is fetched
  // Only fires AFTER nicheState has been fetched (not undefined)
  useEffect(() => {
    // Don't fire if no niche selected
    if (!selectedNiche) return
    // Don't fire if nicheState hasn't been fetched yet (undefined)
    // nicheState === null means fetched but no record exists (new niche = research stage)
    if (nicheState === undefined) return
    
    // Determine current stage using the shared deriveStage helper
    let currentStage = deriveStage(nicheState)
    // If the derivation says "research" but an active offer exists elsewhere,
    // expand the offer section instead so the user sees the right place.
    if (currentStage === "research" && activeOffer) {
      currentStage = "offer"
    }
    
    setExpandedSections({
      whyThisWorks: true, // always expanded
      research: currentStage === "research",
      offer: currentStage === "offer",
      outreach: currentStage === "outreach",
      outreachTracker: currentStage === "outreach",
      demo: currentStage === "demo",
      revival: currentStage === "revival",
    })
  }, [selectedNiche?.id, nicheState, activeOffer])

  useEffect(() => {
    let filtered = [...allNiches]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (n) => n.niche_name.toLowerCase().includes(query) || (n.industry_name || "").toLowerCase().includes(query),
      )
    }

    if (industryFilter !== "all") {
      filtered = filtered.filter((n) => n.industry_id === industryFilter)
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((n) => (n.user_state?.status || "Research") === statusFilter)
    }

    if (favouritesOnly) {
      filtered = filtered.filter((n) => n.user_state?.is_favourite)
    }

    if (sortBy === "score") {
      filtered.sort((a, b) => {
        const scoreA = calculatePipelineScore(a.user_state).pipelineScore
        const scoreB = calculatePipelineScore(b.user_state).pipelineScore
        return scoreB - scoreA
      })
    } else if (sortBy === "alphabetical") {
      filtered.sort((a, b) => a.niche_name.localeCompare(b.niche_name))
    } else if (sortBy === "newest") {
      filtered.sort((a, b) => {
        const dateA = a.user_state?.updated_at ? new Date(a.user_state.updated_at).getTime() : 0
        const dateB = b.user_state?.updated_at ? new Date(b.user_state.updated_at).getTime() : 0
        return dateB - dateA
      })
    }

    setFilteredNiches(filtered)
  }, [allNiches, searchQuery, industryFilter, statusFilter, favouritesOnly, sortBy])

  // Handle niche selection - reset all state immediately to prevent stale data
  const handleNicheSelect = (niche: Niche) => {
    // Reset everything immediately on niche change
    setSelectedNiche(niche)
    setNicheState(undefined) // undefined = not yet fetched (different from null = no record)
    setWhyThisWorksContent(null)
    setLoadingWhyThisWorks(false)
    setAiSuggestions(null)
    // On mobile, flip to the details view so the user sees what they tapped.
    // Desktop is unaffected — both panels stay visible side-by-side.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileView("details")
    }
    // Reset expanded sections to false (auto-expand effect sets correct ones after nicheState loads)
    setExpandedSections({
      whyThisWorks: false,
      research: false,
      offer: false,
      outreach: false,
      outreachTracker: false,
      demo: false,
      revival: false,
    })
  }

  const toggleFavourite = async (niche: Niche) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const newFavState = !niche.user_state?.is_favourite

    const { error } = await supabase.from("niche_user_state").upsert(
      {
        niche_id: niche.id,
        user_id: user.id,
        is_favourite: newFavState,
      },
      { onConflict: "niche_id,user_id" },
    )

    if (!error) {
      setAllNiches((prev) =>
        prev.map((n) =>
          n.id === niche.id ? { ...n, user_state: { ...n.user_state!, is_favourite: newFavState } } : n,
        ),
      )
      if (selectedNiche?.id === niche.id) {
        setSelectedNiche((prev) =>
          prev ? { ...prev, user_state: { ...prev.user_state!, is_favourite: newFavState } } : null,
        )
      }

      // Re-engagement tracking: favouriting a niche counts as active work.
      // Only track when the user is adding a favourite (not removing), and
      // fire-and-forget — a failed track must never block the UI.
      if (newFavState) {
        void fetch("/api/activity/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "niche_favourited" }),
        }).catch(() => {})
      }
    }
  }

  // Ask Claude for realistic industry benchmarks for the selected niche and
  // pre-fill the AOV + database size inputs.
  //
  // IMPORTANT: We deliberately bypass `updateField` here and do ONE atomic
  // upsert for both columns. Calling `updateField` twice back-to-back caused a
  // stale-closure bug where the second call's `setSelectedNiche` rebuilt state
  // from the pre-update `selectedNiche` and wiped the first field (the AOV
  // appeared to vanish, even though it had been written to the DB). A single
  // upsert + a single functional state update keeps client and server in sync.
  const handleGetEstimates = async () => {
    if (!selectedNiche?.niche_name || !selectedNiche?.id) return

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setFetchingEstimates(true)
    try {
      const response = await fetch("/api/niches/aov-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche_name: selectedNiche.niche_name }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error || "Failed to fetch estimates")
      }
      const data = await response.json()

      const avgDbSize = Math.round(
        (Number(data.database_size_low || 0) + Number(data.database_size_high || 0)) / 2,
      )
      const aov = Number(data.average_order_value || 0)
      const nowIso = new Date().toISOString()

      // Single upsert — both columns in one round trip.
      const { error } = await supabase.from("niche_user_state").upsert(
        {
          niche_id: selectedNiche.id,
          user_id: user.id,
          aov_input: aov,
          database_size_input: avgDbSize,
          updated_at: nowIso,
        },
        { onConflict: "niche_id,user_id" },
      )
      if (error) throw new Error(error.message)

      // Functional state updates so we don't clobber anything else the user
      // may have been editing.
      setSelectedNiche((prev) =>
        prev
          ? {
              ...prev,
              user_state: {
                ...(prev.user_state as any),
                aov_input: aov,
                database_size_input: avgDbSize,
                updated_at: nowIso,
              },
            }
          : prev,
      )
      setAllNiches((prev) =>
        prev.map((n) =>
          n.id === selectedNiche.id
            ? {
                ...n,
                user_state: {
                  ...(n.user_state as any),
                  aov_input: aov,
                  database_size_input: avgDbSize,
                  updated_at: nowIso,
                },
              }
            : n,
        ),
      )

      setEstimateNotesByNiche((prev) => ({
        ...prev,
        [selectedNiche.id]: {
          aov_notes: data.aov_notes || "",
          database_size_low: Number(data.database_size_low || 0),
          database_size_high: Number(data.database_size_high || 0),
          database_size_notes: data.database_size_notes || "",
          dormant_percentage: Number(data.dormant_percentage || 0),
          dormant_notes: data.dormant_notes || "",
          reactivation_rate: Number(data.reactivation_rate || 0),
          reactivation_notes: data.reactivation_notes || "",
        },
      }))

      toast({
        title: "AI estimates loaded",
        description: "Adjust values if you have better data for your target market.",
      })
    } catch (error: any) {
      toast({
        title: "Could not load estimates",
        description: error?.message || "Please enter values manually.",
        variant: "destructive",
      })
    } finally {
      setFetchingEstimates(false)
    }
  }

  const updateField = async (field: string, value: any, showToast = true) => {
    if (!selectedNiche) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    setSavingField(field)

    const updateData: any = {
      niche_id: selectedNiche.id,
      user_id: user.id,
      [field]: value,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from("niche_user_state").upsert(updateData, { onConflict: "niche_id,user_id" })

    setSavingField(null)

    if (!error) {
      const updatedNiche = {
        ...selectedNiche,
        user_state: { ...selectedNiche.user_state!, [field]: value, updated_at: new Date().toISOString() },
      }
      setSelectedNiche(updatedNiche)
      setAllNiches((prev) => prev.map((n) => (n.id === selectedNiche.id ? updatedNiche : n)))
      if (showToast) {
        toast({
          title: "Changes saved",
        })
      }
    } else {
      toast({
        title: "Error saving changes",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const progressToStage = async (targetStageId: string) => {
    if (!selectedNiche) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const gating = getStageGating(selectedNiche.user_state)
    const currentStageId = DB_STATUS_TO_STAGE[selectedNiche.user_state?.status || "Research"] || "research"
    const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStageId)
    const targetIdx = PIPELINE_STAGES.findIndex((s) => s.key === targetStageId)

    // Check if we can move forward
    if (targetIdx > currentIdx) {
      if (targetStageId === "shortlisted" && !gating.canMoveToShortlisted) {
        toast({
          title: "Cannot proceed",
          description: gating.shortlistedReason,
          variant: "destructive",
        })
        return
      }
      if (targetStageId === "outreach_in_progress" && !gating.canMoveToOutreach) {
        toast({
          title: "Cannot proceed",
          description: gating.outreachReason,
          variant: "destructive",
        })
        return
      }
      if (targetStageId === "coffee_date_demo" && !gating.canMoveToCoffeeDate) {
        toast({
          title: "Cannot proceed",
          description: gating.coffeeDateReason,
          variant: "destructive",
        })
        return
      }
      // Win progression is now handled by specific win types, not direct stage change.
      // Check if moving to dead_lead_revival stage and if user has coffee_date_completed
      if (targetStageId === "dead_lead_revival" && !selectedNiche?.user_state?.coffee_date_completed) {
        toast({
          title: "Cannot proceed",
          description: "Complete a Coffee Date Demo first",
          variant: "destructive",
        })
        return
      }
    }

    const dbStatus = STAGE_TO_DB_STATUS[targetStageId]

    const updateData: any = {
      niche_id: selectedNiche.id,
      user_id: user.id,
      status: dbStatus,
      updated_at: new Date().toISOString(),
    }

    // Set boolean flags based on target stage
    // removed direct win_completed update from here, handled by specific modals/logic
    // if (targetStageId === "win") {
    //   updateData.win_completed = true
    // }

    const { error } = await supabase.from("niche_user_state").upsert(updateData, { onConflict: "niche_id,user_id" })

    if (!error) {
      const updatedUserState = {
        ...selectedNiche.user_state!,
        status: dbStatus,
        updated_at: new Date().toISOString(),
        // Removed direct win_completed update from here
        // ...(targetStageId === "win" ? { win_completed: true } : {}),
      }
      const updatedNiche = { ...selectedNiche, user_state: updatedUserState }
      setSelectedNiche(updatedNiche)
      setAllNiches((prev) => prev.map((n) => (n.id === selectedNiche.id ? updatedNiche : n)))
      fetchAiSuggestions(updatedNiche)
      toast({
        title: "Pipeline Updated",
        description: `Moved to ${STAGE_TO_DB_STATUS[targetStageId]}`,
      })

      // Open the appropriate card
      if (targetStageId === "shortlisted") {
        setResearchOpen(false)
        setMessagingOpen(true)
        setOutreachOpen(false)
      } else if (
        targetStageId === "outreach_in_progress" ||
        targetStageId === "coffee_date_demo" ||
        // Handle opening outreach panel for dead_lead_revival too
        targetStageId === "dead_lead_revival"
      ) {
        setResearchOpen(false)
        setMessagingOpen(false)
        setOutreachOpen(true)
      }
    } else {
      toast({
        title: "Error updating pipeline",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const setOutreachChannelValue = async (channel: keyof OutreachChannels, newValue: number) => {
    if (!selectedNiche) return
    setUpdatingChannel(channel)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUpdatingChannel(null)
      return
    }

    const currentChannels = selectedNiche.user_state?.outreach_channels || {}
    const newChannels = { ...currentChannels, [channel]: newValue }

    // Calculate total messages sent (manual extras across all channels)
    const totalSent =
      (newChannels.linkedin_messages || 0) +
      (newChannels.instagram_messages || 0) +
      (newChannels.facebook_dms || 0) +
      (newChannels.cold_calls || 0) +
      (newChannels.emails || 0)

    const { error } = await supabase.from("niche_user_state").upsert(
      {
        niche_id: selectedNiche.id,
        user_id: user.id,
        outreach_channels: newChannels,
        outreach_messages_sent: totalSent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "niche_id,user_id" },
    )

    if (!error) {
      const updatedNiche = {
        ...selectedNiche,
        user_state: {
          ...selectedNiche.user_state!,
          outreach_channels: newChannels,
          outreach_messages_sent: totalSent,
          updated_at: new Date().toISOString(),
        },
      }
      setSelectedNiche(updatedNiche)
      setAllNiches((prev) => prev.map((n) => (n.id === selectedNiche.id ? updatedNiche : n)))
      toast({
        title: "Saved",
        description: `${channel.replace("_", " ")} updated to ${newValue}`,
      })
    } else {
      toast({
        title: "Error updating channel value",
        description: error.message,
        variant: "destructive",
      })
    }

    setUpdatingChannel(null)
  }

  const handleToggleOutreachComplete = async () => {
    if (!selectedNiche) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const currentlyComplete = !!selectedNiche.user_state?.outreach_complete
    const nextValue = !currentlyComplete
    const now = new Date().toISOString()

    const { error } = await supabase.from("niche_user_state").upsert(
      {
        niche_id: selectedNiche.id,
        user_id: user.id,
        outreach_complete: nextValue,
        outreach_complete_at: nextValue ? now : null,
        updated_at: now,
      },
      { onConflict: "niche_id,user_id" },
    )

    if (!error) {
      const updatedNiche = {
        ...selectedNiche,
        user_state: {
          ...selectedNiche.user_state!,
          outreach_complete: nextValue,
          outreach_complete_at: nextValue ? now : null,
          updated_at: now,
        },
      }
      setSelectedNiche(updatedNiche)
      setAllNiches((prev) => prev.map((n) => (n.id === selectedNiche.id ? updatedNiche : n)))
      toast({
        title: nextValue ? "Outreach marked complete" : "Outreach reopened",
        description: nextValue
          ? "Great work. Now secure a Coffee Date Demo."
          : "You can continue logging outreach activity.",
      })
    } else {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleCoffeeDateComplete = async (nicheId: string | null, nicheName: string) => {
    if (!nicheId) {
      // "Other" selected - no pipeline update
      toast({
        title: "Demo Logged",
        description: "Coffee date logged for other niche (no pipeline update)",
      })
      setShowCoffeeDateModal(false)
      setCoffeeDateStep("type")
      setCoffeeDateType(null)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    // Update the niche_user_state
    const { error } = await supabase.from("niche_user_state").upsert(
      {
        niche_id: nicheId,
        user_id: user.id,
        coffee_date_completed: true,
        status: "Coffee Date Demo",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "niche_id,user_id" },
    )

    if (!error) {
      // Update local state if this is the selected niche
      if (selectedNiche?.id === nicheId) {
        const updatedNiche = {
          ...selectedNiche,
          user_state: {
            ...selectedNiche.user_state!,
            coffee_date_completed: true,
            status: "Coffee Date Demo" as any,
            updated_at: new Date().toISOString(),
          },
        }
        setSelectedNiche(updatedNiche)
        setAllNiches((prev) => prev.map((n) => (n.id === nicheId ? updatedNiche : n)))
      } else {
        // Reload to get updated data
        loadData()
      }

      toast({
        title: "Coffee Date Logged",
        description: `Coffee date logged for ${nicheName}`,
      })
    } else {
      toast({
        title: "Error logging coffee date",
        description: error.message,
        variant: "destructive",
      })
    }

    setShowCoffeeDateModal(false)
    setCoffeeDateStep("type")
    setCoffeeDateType(null)
  }

  const handleWinComplete = async (nicheId: string | null, nicheName: string) => {
    if (!nicheId) {
      toast({
        title: "Win Recorded",
        description: "Win recorded for other niche (no pipeline update)",
      })
      setShowWinModal(false)
      return
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("niche_user_state").upsert(
      {
        niche_id: nicheId,
        user_id: user.id,
        win_completed: true, // This will now be a general win flag, with win_type determining specifics
        status: "Win", // Setting status to Win, although it might be overridden by Coffee Date logic if needed. Consider if status should be solely Coffee Date Demo.
        updated_at: new Date().toISOString(),
      },
      { onConflict: "niche_id,user_id" },
    )

    if (!error) {
      if (selectedNiche?.id === nicheId) {
        const updatedNiche = {
          ...selectedNiche,
          user_state: {
            ...selectedNiche.user_state!,
            win_completed: true,
            status: "Win" as any, // Setting status to "Win"
            updated_at: new Date().toISOString(),
          },
        }
        setSelectedNiche(updatedNiche)
        setAllNiches((prev) => prev.map((n) => (n.id === nicheId ? updatedNiche : n)))
      } else {
        loadData()
      }

      toast({
        title: "Win Recorded",
        description: `Win recorded for ${nicheName}`,
      })
    } else {
      toast({
        title: "Error recording win",
        description: error.message,
        variant: "destructive",
      })
    }

    setShowWinModal(false)
  }

  const currentStageId = DB_STATUS_TO_STAGE[selectedNiche?.user_state?.status || "Research"] || "research"
  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.key === currentStageId)
  const stageGating = getStageGating(selectedNiche?.user_state || null)

  const selectedNicheScore = selectedNiche ? calculatePipelineScore(selectedNiche.user_state) : null
  const selectedNicheTier = selectedNicheScore ? getPriorityTier(selectedNicheScore.pipelineScore) : "cold"
  const selectedNicheAlerts = selectedNiche ? getAutomationAlerts(selectedNiche.user_state) : []

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-black p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Opportunities</h1>
          <p className="text-white/60">Find high-potential niches and start outreach</p>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-white/10 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Search niches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-800 border-zinc-700 text-white placeholder:text-white/40"
            />
          </div>

          <Select value={industryFilter} onValueChange={handleIndustryChange}>
            <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-white">
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="all" className="text-white hover:bg-zinc-700">
                All Industries
              </SelectItem>
              {industries.map((industry) => (
                <SelectItem key={industry.id} value={industry.id} className="text-white hover:bg-zinc-700">
                  {industry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="all" className="text-white hover:bg-zinc-700">
                All Statuses
              </SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem
                  key={stage.key}
                  value={STAGE_TO_DB_STATUS[stage.key]}
                  className="text-white hover:bg-zinc-700"
                >
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] bg-zinc-800 border-zinc-700 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              <SelectItem value="score" className="text-white hover:bg-zinc-700">
                Pipeline Score
              </SelectItem>
              <SelectItem value="alphabetical" className="text-white hover:bg-zinc-700">
                Alphabetical
              </SelectItem>
              <SelectItem value="newest" className="text-white hover:bg-zinc-700">
                Recently Updated
              </SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Checkbox
              id="favourites"
              checked={favouritesOnly}
              onCheckedChange={(checked) => setFavouritesOnly(checked === true)}
              className="border-zinc-600 data-[state=checked]:bg-primary"
            />
            <Label htmlFor="favourites" className="text-sm text-white/80 cursor-pointer">
              Favourites
            </Label>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-6">
            {/* Niche List - Left (hidden on mobile when viewing details) */}
            <div className={cn(
              "lg:col-span-5 space-y-4",
              mobileView === "details" ? "hidden lg:block" : "block",
            )}>
              <div className="text-sm text-white/60">{filteredNiches.length} Niches</div>
              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                {filteredNiches.map((niche) => {
                  const score = calculatePipelineScore(niche.user_state)
                  const tier = getPriorityTier(score.pipelineScore)
                  const stageId = deriveStage(niche.user_state)
                  const stage = PIPELINE_STAGES.find((s) => s.key === stageId)
                  const hasRevivalWin =
                    niche.user_state?.revival_win_completed || niche.user_state?.win_type === "revival"
                  const hasAuditWin = niche.user_state?.audit_win_completed || niche.user_state?.win_type === "audit"
                  const hasAnyWin = niche.user_state?.win_completed || hasRevivalWin || hasAuditWin
                  const isClientOnboarded = !!niche.user_state?.client_onboarded
                  const hasProposalWon = !!niche.user_state?.proposal_won

                  return (
                    <Card
                      key={niche.id}
                      onClick={() => handleNicheSelect(niche)}
                      className={cn(
                        "p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 border",
                        selectedNiche?.id === niche.id
                          ? "border-primary bg-primary/10"
                          : tier === "hot"
                            ? "border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-red-500/5 hover:border-orange-500/50"
                            : tier === "warm"
                              ? "border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/5 hover:border-yellow-500/50"
                              : "border-white/10 bg-zinc-900/50 hover:border-white/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-full text-[10px]",
                                tier === "hot"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : tier === "warm"
                                    ? "bg-yellow-500/20 text-yellow-400"
                                    : "bg-blue-500/20 text-blue-400",
                              )}
                            >
                              {tier === "hot" && <Flame className="h-3 w-3" />}
                              {tier === "warm" && <TrendingUp className="h-3 w-3" />}
                              {tier === "cold" && <Snowflake className="h-3 w-3" />}
                            </span>
                            <span className="truncate text-[#F5F5F5] font-medium">{niche.niche_name}</span>
                            {/* Win type indicators with tooltips */}
                            {hasAnyWin && (
                              <span className="flex items-center gap-1 ml-1">
                                {hasRevivalWin && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Trophy className="h-3.5 w-3.5 text-teal-400" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="bg-zinc-800 text-white border-zinc-700 text-xs"
                                    >
                                      Revival Win
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {hasAuditWin && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <FileSpreadsheet className="h-3.5 w-3.5 text-purple-400" />
                                    </TooltipTrigger>
                                    <TooltipContent
                                      side="top"
                                      className="bg-zinc-800 text-white border-zinc-700 text-xs"
                                    >
                                      AI Audit Win
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-[#B0B0B0]">{niche.industry_name}</span>
                            {hasProposalWon && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                Won
                              </span>
                            )}
                            {isClientOnboarded && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">
                                Client Onboarded
                              </span>
                            )}
                            {!hasProposalWon && !isClientOnboarded && hasAnyWin && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                                Win
                              </span>
                            )}
                            {!hasProposalWon && !isClientOnboarded && !hasAnyWin && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#B0B0B0]">
                                {stage?.label || "Research"}
                              </span>
                            )}
                            <span className="text-xs text-[#808080]">Score: {score.pipelineScore}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFavourite(niche)
                            }}
                            className="shrink-0"
                          >
                            <Star
                              className={cn(
                                "h-4 w-4 transition-colors",
                                niche.user_state?.is_favourite
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-white/30 hover:text-white/50",
                              )}
                            />
                            </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              const painPoint = `${niche.industry_name || "These"} businesses have dormant customer lists they struggle to reactivate`
                              const outcome = `Reactivating 5-10% of dormant leads generates significant recurring revenue`
                              const params = new URLSearchParams({
                                niche: niche.niche_name,
                                problem: painPoint,
                                outcome: outcome,
                              })
                              window.location.href = `/offer/builder?${params.toString()}`
                            }}
                            className="h-6 px-2 text-xs text-white/50 hover:text-white hover:bg-white/10"
                          >
                            Build offer &rarr;
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>

            {/* Detail Panel - Right (hidden on mobile when viewing list) */}
            <div className={cn(
              "lg:col-span-7 mt-4 lg:mt-0",
              mobileView === "list" ? "hidden lg:block" : "block",
            )}>
              {/* Back-to-list button for mobile only */}
              {selectedNiche && (
                <button
                  onClick={() => setMobileView("list")}
                  className="lg:hidden mb-3 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white min-h-[44px]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to niches
                </button>
              )}
              {selectedNiche ? (
                <Card className="border border-white/10 bg-zinc-900/50 p-4 sm:p-6 space-y-6 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto rounded-xl [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-white">{selectedNiche.niche_name}</h2>
                        <span
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                            selectedNicheTier === "hot"
                              ? "bg-gradient-to-r from-orange-500 to-red-500 text-white"
                              : selectedNicheTier === "warm"
                                ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-black"
                                : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
                          )}
                        >
                          {selectedNicheTier === "hot" && <Flame className="h-3 w-3" />}
                          {selectedNicheTier === "warm" && <TrendingUp className="h-3 w-3" />}
                          {selectedNicheTier === "cold" && <Snowflake className="h-3 w-3" />}
                          {selectedNicheTier.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-white/60 mt-1">{selectedNiche.industry_name}</p>
                      {selectedNicheScore && (
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-white/40">Pipeline Score:</span>
                            <span className="text-white font-semibold">{selectedNicheScore.pipelineScore}</span>
                          </div>
                          <div className="flex items-center gap-2 text-white/40">
                            <span>Stage: {selectedNicheScore.stageScore}</span>
                            <span>+</span>
                            <span>Activity: {selectedNicheScore.activityScore}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedNiche(null)
                        setMobileView("list")
                      }}
                      className="text-white/60 hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Close details"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Automation Alerts */}
                  {selectedNicheAlerts.length > 0 && (
                    <div className="space-y-2">
                      {selectedNicheAlerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg text-sm",
                            alert.type === "warning"
                              ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                              : alert.type === "success"
                                ? "bg-green-500/10 border border-green-500/30 text-green-300"
                                : "bg-blue-500/10 border border-blue-500/30 text-blue-300",
                          )}
                        >
                          {alert.type === "warning" && <AlertTriangle className="h-4 w-4 shrink-0" />}
                          {alert.type === "success" && <CheckCircle className="h-4 w-4 shrink-0" />}
                          {alert.type === "info" && <Lightbulb className="h-4 w-4 shrink-0" />}
                          {alert.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Calculate current stage for use in stage tracker and section headers */}
                  {(() => {
                    // Use the shared derivation so this tracker stays in sync with the
                    // list card tag, the section dots, and the pipeline score.
                    // Fall back to `offer` when the user has an active offer but no niche state yet.
                    let currentStage: string
                    if (nicheState !== undefined && nicheState !== null) {
                      currentStage = deriveStage(nicheState)
                    } else if (activeOffer) {
                      currentStage = "offer"
                    } else {
                      currentStage = "research"
                    }

                    const stageIndex = PIPELINE_STAGES.findIndex(s => s.key === currentStage)
                    
                    return (
                      <>
                  {/* Pipeline Stage Tracker - Research → Offer → Outreach → Demo → Revival */}
                  <div className="flex items-center gap-0 mb-6">
                    {PIPELINE_STAGES.map((stage, index) => (
                        <div key={stage.key} className="flex items-center">
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                            index < stageIndex
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : index === stageIndex
                              ? "bg-[#00AAFF]/20 text-[#00AAFF] border border-[#00AAFF]/30"
                              : "bg-white/5 text-white/25 border border-white/10"
                          )}>
                            {index < stageIndex ? (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                            ) : index > stageIndex ? (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <rect x="3" y="2" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1"/>
                                <path d="M3.5 4V3a1.5 1.5 0 013 0v1" stroke="currentColor" strokeWidth="1"/>
                              </svg>
                            ) : null}
                            {stage.label}
                          </div>
                          {index < PIPELINE_STAGES.length - 1 && (
                            <div className={cn("w-6 h-px", index < stageIndex ? "bg-green-500/40" : "bg-white/10")} />
                          )}
                        </div>
                      ))}
                  </div>

{/* Why This Works Section - AI Generated */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("whyThisWorks")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#00AAFF] animate-pulse" />
                        <span className="text-sm font-medium text-white/70">Why This Works</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.whyThisWorks ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.whyThisWorks && (
                      <div className="px-4 pb-4">
                        <div className="bg-white/[0.03] border-l-4 border-l-[#00AAFF] border border-white/10 rounded-xl p-5 space-y-3">
                          {loadingWhyThisWorks ? (
                            <div className="flex items-center gap-3 py-2">
                              <Loader2 className="animate-spin h-4 w-4 text-[#00AAFF]" />
                              <span className="text-sm text-white/50">Analysing this niche...</span>
                            </div>
                          ) : whyThisWorksContent ? (
                            <p className="text-sm text-white/70 leading-relaxed" style={{ lineHeight: 1.7 }}>
                              {whyThisWorksContent}
                            </p>
                          ) : (
                            <p className="text-sm text-white/50 italic">
                              Click on a niche to generate AI analysis
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Research Phase Section */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("research")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          getSectionStatus("research") === "completed" ? "bg-green-500" :
                          getSectionStatus("research") === "current" ? "bg-[#00AAFF] animate-pulse" :
                          "bg-white/20"
                        )} />
                        <span className="text-sm font-medium text-white/70">Research Phase</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.research ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.research && (
                      <div className="px-4 pb-4 space-y-4">
                          {/* Research Notes */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm text-white/80">Research Notes</Label>
                              {savingField === "research_notes" && (
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                              )}
                            </div>
                            <Textarea
                              placeholder="Add your research notes about this niche..."
                              value={selectedNiche.user_state?.research_notes || ""}
                              onChange={(e) => {
                                setSelectedNiche((prev) =>
                                  prev
                                    ? { ...prev, user_state: { ...prev.user_state!, research_notes: e.target.value } }
                                    : null,
                                )
                              }}
                              onBlur={(e) => {
                                updateField("research_notes", e.target.value, false)
                                if (e.target.value && !selectedNiche.user_state?.research_notes_added) {
                                  updateField("research_notes_added", true)
                                }
                              }}
                              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 min-h-[80px]"
                            />
                          </div>

                          {/* AOV Calculator */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <Calculator className="h-4 w-4 text-green-400" />
                              <Label className="text-sm text-white/80">AOV & Database Snapshot</Label>
                            </div>

                            {/* AI pre-fill prompt — shown only when both inputs
                                are empty AND we haven't already loaded notes
                                for this niche. Clicking it asks Claude for
                                realistic benchmarks and fills the inputs. */}
                            {!selectedNiche.user_state?.aov_input &&
                              !selectedNiche.user_state?.database_size_input &&
                              !estimateNotesByNiche[selectedNiche.id] && (
                                <div className="border border-[#00AAFF]/25 bg-[#00AAFF]/5 rounded-lg p-4 flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-0.5">
                                      AI-powered estimates
                                    </p>
                                    <p className="text-white text-sm">
                                      Let Claude research typical values for{" "}
                                      <span className="font-semibold">{selectedNiche.niche_name}</span>
                                    </p>
                                  </div>
                                  <Button
                                    onClick={handleGetEstimates}
                                    disabled={fetchingEstimates}
                                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-bold whitespace-nowrap disabled:opacity-60"
                                  >
                                    {fetchingEstimates ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Researching...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Get AI estimates
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">Database Size</Label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 5000"
                                  value={selectedNiche.user_state?.database_size_input || ""}
                                  onChange={(e) => {
                                    const val = Number.parseInt(e.target.value) || null
                                    setSelectedNiche((prev) =>
                                      prev
                                        ? { ...prev, user_state: { ...prev.user_state!, database_size_input: val } }
                                        : null,
                                    )
                                  }}
                                  onBlur={(e) =>
                                    updateField("database_size_input", Number.parseInt(e.target.value) || null, false)
                                  }
                                  className="bg-zinc-900 border-zinc-700 text-white"
                                />
                                {estimateNotesByNiche[selectedNiche.id] && (
                                  <p className="text-white/40 text-[11px] italic leading-snug mt-1">
                                    {estimateNotesByNiche[selectedNiche.id].database_size_notes}
                                    {" — typical: "}
                                    {estimateNotesByNiche[selectedNiche.id].database_size_low.toLocaleString()}
                                    {"–"}
                                    {estimateNotesByNiche[selectedNiche.id].database_size_high.toLocaleString()}
                                  </p>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">AOV ($)</Label>
                                <Input
                                  type="number"
                                  placeholder="e.g. 250"
                                  value={selectedNiche.user_state?.aov_input || ""}
                                  onChange={(e) => {
                                    const val = Number.parseFloat(e.target.value) || null
                                    setSelectedNiche((prev) =>
                                      prev ? { ...prev, user_state: { ...prev.user_state!, aov_input: val } } : null,
                                    )
                                  }}
                                  onBlur={(e) =>
                                    updateField("aov_input", Number.parseFloat(e.target.value) || null, false)
                                  }
                                  className="bg-zinc-900 border-zinc-700 text-white"
                                />
                                {estimateNotesByNiche[selectedNiche.id] && (
                                  <p className="text-white/40 text-[11px] italic leading-snug mt-1">
                                    {estimateNotesByNiche[selectedNiche.id].aov_notes}
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Opportunity estimate — only shown once both inputs
                                have values AND we have the AI notes (which include
                                the dormant % and reactivation rate we multiply by).
                                Calculator is the shared calculateRecoverableRevenue()
                                helper from /lib/pricing/calculateRevenue.ts — same
                                maths used anywhere commissions are projected. */}
                            {selectedNiche.user_state?.aov_input &&
                              selectedNiche.user_state?.database_size_input &&
                              estimateNotesByNiche[selectedNiche.id] &&
                              (() => {
                                const notes = estimateNotesByNiche[selectedNiche.id]
                                // Parse the numeric portion out of the offer's
                                // price_point (e.g. "$25 per qualified lead" -> 25).
                                // Only used when an active offer exists and its
                                // niche matches the one we're looking at; otherwise
                                // we skip commission projection entirely.
                                const matchedOffer = activeOffer && nicheMatches ? activeOffer : null
                                const commissionPct = matchedOffer
                                  ? parsePricePoint(matchedOffer.price_point)
                                  : null

                                const result = calculateRecoverableRevenue({
                                  databaseSize: Number(selectedNiche.user_state.database_size_input),
                                  aov: Number(selectedNiche.user_state.aov_input),
                                  dormantPercentage: notes.dormant_percentage,
                                  reactivationRate: notes.reactivation_rate,
                                  pricingModel: matchedOffer?.pricing_model,
                                  commissionPercentage: commissionPct,
                                })

                                return (
                                  <div className="border border-[#00AAFF]/25 bg-[#00AAFF]/5 rounded-xl p-5">
                                    <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-3">
                                      Opportunity estimate
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                      <div>
                                        <p className="text-white/50 text-xs mb-0.5">Dormant leads</p>
                                        <p className="text-white font-bold text-lg">
                                          {result.dormantLeads.toLocaleString()}
                                        </p>
                                        <p className="text-white/40 text-xs">
                                          {notes.dormant_percentage}% of database
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-white/50 text-xs mb-0.5">Recoverable revenue</p>
                                        <p className="text-[#00AAFF] font-bold text-lg">
                                          ${result.recoverableRevenue.toLocaleString()}
                                        </p>
                                        <p className="text-white/40 text-xs">
                                          {notes.reactivation_rate}% reactivation rate
                                        </p>
                                      </div>
                                    </div>

                                    {/* Operator commission row — only shown when
                                        an active offer is matched to this niche.
                                        For profit-share models we can only
                                        surface a note (margin unknown); for
                                        per-lead / per-conversation we compute
                                        the exact figure. */}
                                    {matchedOffer && (
                                      <div className="border-t border-white/10 pt-3 mb-3">
                                        {result.operatorCommission !== null ? (
                                          <div className="flex items-baseline justify-between gap-3">
                                            <p className="text-white/50 text-xs">Your projected commission</p>
                                            <p className="text-emerald-400 font-bold text-lg">
                                              ${Math.round(result.operatorCommission).toLocaleString()}
                                            </p>
                                          </div>
                                        ) : null}
                                        <p className="text-white/60 text-xs leading-relaxed mt-1">
                                          {result.commissionNote}
                                        </p>
                                      </div>
                                    )}

                                    <p className="text-white/50 text-xs leading-relaxed">
                                      {notes.dormant_notes} {notes.reactivation_notes}
                                    </p>

                                    {/* Persist computed values to the three
                                        previously-dead niche_user_state columns
                                        so other parts of the app (clients,
                                        dashboard, future pipeline views) can
                                        read them without re-running the maths.
                                        Runs once per result on mount via the
                                        hidden RevenuePersister helper below. */}
                                    <RevenuePersister
                                      nicheId={selectedNiche.id}
                                      result={result}
                                      pricingModel={matchedOffer?.pricing_model ?? null}
                                      commissionPct={commissionPct}
                                    />
                                  </div>
                                )
                              })()}

                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="aov_complete"
                                checked={selectedNiche.user_state?.aov_calculator_completed || false}
                                onCheckedChange={(checked) => updateField("aov_calculator_completed", checked === true)}
                                className="border-zinc-600 data-[state=checked]:bg-green-500"
                              />
                              <Label htmlFor="aov_complete" className="text-sm text-white/80 cursor-pointer">
                                Mark AOV as Complete
                              </Label>
                            </div>
                          </div>

                          {/* Customer Profile */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-purple-400" />
                              <Label className="text-sm text-white/80">Customer Profile Summary</Label>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">Decision Maker</Label>
                                <Input
                                  placeholder="e.g. Owner, Marketing Manager"
                                  value={selectedNiche.user_state?.customer_profile?.decision_maker || ""}
                                  onChange={(e) => {
                                    const profile = {
                                      ...selectedNiche.user_state?.customer_profile,
                                      decision_maker: e.target.value,
                                    }
                                    setSelectedNiche((prev) =>
                                      prev
                                        ? { ...prev, user_state: { ...prev.user_state!, customer_profile: profile } }
                                        : null,
                                    )
                                  }}
                                  onBlur={(e) => {
                                    const profile = {
                                      ...selectedNiche.user_state?.customer_profile,
                                      decision_maker: e.target.value,
                                    }
                                    updateField("customer_profile", profile, false)
                                  }}
                                  className="bg-zinc-900 border-zinc-700 text-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">Pain Points</Label>
                                <Textarea
                                  placeholder="Main challenges they face..."
                                  value={selectedNiche.user_state?.customer_profile?.pain_points || ""}
                                  onChange={(e) => {
                                    const profile = {
                                      ...selectedNiche.user_state?.customer_profile,
                                      pain_points: e.target.value,
                                    }
                                    setSelectedNiche((prev) =>
                                      prev
                                        ? { ...prev, user_state: { ...prev.user_state!, customer_profile: profile } }
                                        : null,
                                    )
                                  }}
                                  onBlur={(e) => {
                                    const profile = {
                                      ...selectedNiche.user_state?.customer_profile,
                                      pain_points: e.target.value,
                                    }
                                    updateField("customer_profile", profile, false)
                                  }}
                                  className="bg-zinc-900 border-zinc-700 text-white min-h-[60px]"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-white/60">Where They Gather</Label>
                                <Input
                                  placeholder="e.g. Facebook groups, LinkedIn, trade shows"
                                  value={selectedNiche.user_state?.customer_profile?.gathering_places || ""}
                                  onChange={(e) => {
                                    const profile = {
                                      ...selectedNiche.user_state?.customer_profile,
                                      gathering_places: e.target.value,
                                    }
                                    setSelectedNiche((prev) =>
                                      prev
                                        ? { ...prev, user_state: { ...prev.user_state!, customer_profile: profile } }
                                        : null,
                                    )
                                  }}
                                  onBlur={(e) => {
                                    const profile = {
                                      ...selectedNiche.user_state?.customer_profile,
                                      gathering_places: e.target.value,
                                    }
                                    updateField("customer_profile", profile, false)
                                  }}
                                  className="bg-zinc-900 border-zinc-700 text-white"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="profile_complete"
                                checked={selectedNiche.user_state?.customer_profile_generated || false}
                                onCheckedChange={(checked) =>
                                  updateField("customer_profile_generated", checked === true)
                                }
                                className="border-zinc-600 data-[state=checked]:bg-green-500"
                              />
                              <Label htmlFor="profile_complete" className="text-sm text-white/80 cursor-pointer">
                                Mark Profile as Complete
                              </Label>
                            </div>
                          </div>

                          {/* Success message once profile is marked complete */}
                          {selectedNiche.user_state?.customer_profile_generated && (
                            <div
                              className="rounded-lg px-4 py-3 flex items-center gap-2"
                              style={{
                                background: "rgba(0,170,255,0.08)",
                                border: "0.5px solid rgba(0,170,255,0.3)",
                              }}
                            >
                              <CheckCircle className="h-4 w-4 text-[#00AAFF] shrink-0" />
                              <p className="text-sm font-medium text-[#00AAFF]">
                                Now Build Your Offer Below
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Section 3 — Your Offer */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("offer")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          getSectionStatus("offer") === "completed" ? "bg-green-500" :
                          getSectionStatus("offer") === "current" ? "bg-[#00AAFF] animate-pulse" :
                          "bg-white/20"
                        )} />
                        <span className="text-sm font-medium text-white/70">Build Your Offer</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.offer ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.offer && (
                      <div className="px-4 pb-4">
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3">
                          {!activeOffer || !nicheMatches ? (
                            <>
                              <p className="text-sm text-white/50 mb-3">
                                Use your research to build a niche-specific offer
                              </p>
                              <Button
                                asChild
                                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                              >
                                <Link href={`/offer/builder?niche=${encodeURIComponent(selectedNiche.niche_name)}&problem=${encodeURIComponent(selectedNiche.user_state?.customer_profile?.pain_points || `${selectedNiche.industry_name || "These"} businesses have dormant customer lists`)}&outcome=${encodeURIComponent("Reactivated dormant customers into recurring revenue")}`}>
                                  Build offer for this niche
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <>
<p className="text-white font-bold text-base">{activeOffer.niche}</p>
  <p className="text-white/40 text-sm">{activeOffer.service_name}</p>
  <p className="text-white/50 text-sm mt-1">
  {activeOffer.price_point} — <span className="capitalize">{activeOffer.pricing_model}</span>
  </p>
                              <Button
                                asChild
                                variant="outline"
                                className="w-full border-white/20 text-white hover:bg-white/10"
                              >
                                <Link href="/offer/builder">Edit offer</Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 4 — Outreach */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("outreach")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          getSectionStatus("outreach") === "completed" ? "bg-green-500" :
                          getSectionStatus("outreach") === "current" ? "bg-[#00AAFF] animate-pulse" :
                          "bg-white/20"
                        )} />
                        <span className="text-sm font-medium text-white/70">Outreach Messages</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.outreach ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.outreach && (
                      <div className="px-4 pb-4">
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3">
                          {!selectedNiche.user_state?.outreach_generated ? (
                            <>
                              <p className="text-sm text-white/50 mb-3">
                                Generate messages for this niche
                              </p>
                              <Button
                                asChild
                                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                              >
                                <Link href="/outreach">
                                  Generate outreach messages
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Link>
                              </Button>
                            </>
                          ) : (
                            <>
                              <div className="flex gap-3 mb-3">
                                {["linkedin", "instagram", "email"].map(channel => (
                                  <div key={channel} className="text-center flex-1">
                                    <p className="text-white text-sm font-medium capitalize">{channel}</p>
                                    <p className="text-white/40 text-xs">
                                      {selectedNiche.user_state?.outreach_channels?.[`${channel}_sent` as keyof OutreachChannels] || 0} sent
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <Button
                                asChild
                                variant="outline"
                                className="w-full border-white/20 text-white hover:bg-white/10"
                              >
                                <Link href="/outreach">View outreach messages</Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 5 — Outreach Tracker */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("outreachTracker")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            (() => {
                              const ch = selectedNiche.user_state?.outreach_channels || {}
                              const hasManualExtras =
                                (ch.linkedin_messages || 0) > 0 ||
                                (ch.instagram_messages || 0) > 0 ||
                                (ch.emails || 0) > 0 ||
                                (ch.cold_calls || 0) > 0 ||
                                (ch.meetings_booked || 0) > 0 ||
                                !!ch.objections
                              const hasAutoCounts =
                                autoOutreachCounts.linkedin.created > 0 ||
                                autoOutreachCounts.instagram.created > 0 ||
                                autoOutreachCounts.email.created > 0
                              const hasAny =
                                !!selectedNiche.user_state?.outreach_complete ||
                                !!selectedNiche.user_state?.outreach_start_date ||
                                hasManualExtras ||
                                hasAutoCounts
                              return hasAny ? "bg-green-500" : "bg-[#00AAFF] animate-pulse"
                            })(),
                          )}
                        />
                        <span className="text-sm font-medium text-white/70">Outreach Tracker</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.outreachTracker ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.outreachTracker && (
                      <div className="px-4 pb-4 space-y-4">
                          {/* Outreach Start Date */}
                          <div className="space-y-2">
                            <Label className="text-sm text-white/80">Outreach Start Date</Label>
                            <Input
                              type="date"
                              value={selectedNiche.user_state?.outreach_start_date || ""}
                              onChange={(e) => {
                                setSelectedNiche((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        user_state: { ...prev.user_state!, outreach_start_date: e.target.value },
                                      }
                                    : null,
                                )
                              }}
                              onBlur={(e) => updateField("outreach_start_date", e.target.value, false)}
                              className="bg-zinc-900 border-zinc-700 text-white w-48"
                            />
                          </div>

                          <p className="text-xs text-white/50 leading-relaxed">
                            Each LinkedIn, Instagram, and Email card shows how many messages were
                            <span className="text-white/80"> created</span> and how many were
                            <span className="text-white/80"> sent</span> from the Outreach tool for this niche.
                            The big number on each card is total sent (including any Extras you log here).
                            Cold Calls are fully manual.
                          </p>

                          {/* Channel Counters — auto-tracked channels show auto + extras */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                              {
                                key: "linkedin_messages" as const,
                                autoKey: "linkedin" as const,
                                label: "LinkedIn",
                                icon: MessageSquare,
                                color: "text-blue-400",
                                autoTracked: true,
                              },
                              {
                                key: "instagram_messages" as const,
                                autoKey: "instagram" as const,
                                label: "Instagram",
                                icon: MessageSquare,
                                color: "text-pink-400",
                                autoTracked: true,
                              },
                              {
                                key: "emails" as const,
                                autoKey: "email" as const,
                                label: "Emails",
                                icon: Mail,
                                color: "text-purple-400",
                                autoTracked: true,
                              },
                              {
                                key: "cold_calls" as const,
                                autoKey: null,
                                label: "Cold Calls",
                                icon: Phone,
                                color: "text-green-400",
                                autoTracked: false,
                              },
                            ].map((channel) => {
                              const Icon = channel.icon
                              const extras = selectedNiche.user_state?.outreach_channels?.[channel.key] || 0
                              const auto = channel.autoKey
                                ? autoOutreachCounts[channel.autoKey]
                                : { created: 0, sent: 0 }
                              const totalSent = auto.sent + extras
                              return (
                                <div
                                  key={channel.key}
                                  className="p-3 bg-zinc-900 rounded-lg space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Icon className={cn("h-4 w-4", channel.color)} />
                                      <span className="text-sm text-white/80">{channel.label}</span>
                                    </div>
                                    <span className="text-lg font-semibold text-white tabular-nums">{totalSent}</span>
                                  </div>
                                  {channel.autoTracked && (
                                    <div className="flex items-center justify-between text-[11px] text-white/40 gap-3">
                                      <span>
                                        <span className="text-white/60 tabular-nums">{auto.created}</span> created
                                      </span>
                                      <span>
                                        <span className="text-white/60 tabular-nums">{auto.sent}</span> sent from Outreach
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                                    <span className="text-[11px] text-white/50">
                                      {channel.autoTracked ? "Extras" : "Manual"}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setOutreachChannelValue(channel.key, Math.max(0, extras - 1))}
                                        disabled={updatingChannel === channel.key}
                                        className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-50"
                                      >
                                        <Minus className="h-4 w-4" />
                                      </button>
                                      <EditableCounter
                                        value={extras}
                                        onChange={setOutreachChannelValue}
                                        channelKey={channel.key}
                                        isUpdating={updatingChannel === channel.key}
                                      />
                                      <button
                                        onClick={() => setOutreachChannelValue(channel.key, extras + 1)}
                                        disabled={updatingChannel === channel.key}
                                        className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-50"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Objections & Notes */}
                          <div className="space-y-2">
                            <Label className="text-sm text-white/80">Objections Heard</Label>
                            <Textarea
                              placeholder="Note any objections or pushback..."
                              value={selectedNiche.user_state?.outreach_notes || ""}
                              onChange={(e) => {
                                setSelectedNiche((prev) =>
                                  prev
                                    ? { ...prev, user_state: { ...prev.user_state!, outreach_notes: e.target.value } }
                                    : null,
                                )
                              }}
                              onBlur={(e) => updateField("outreach_notes", e.target.value, false)}
                              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 min-h-[60px]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm text-white/80">General Notes</Label>
                            <Textarea
                              placeholder="Additional notes about this outreach..."
                              value={selectedNiche.user_state?.notes || ""}
                              onChange={(e) => {
                                setSelectedNiche((prev) =>
                                  prev ? { ...prev, user_state: { ...prev.user_state!, notes: e.target.value } } : null,
                                )
                              }}
                              onBlur={(e) => updateField("notes", e.target.value, false)}
                              className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 min-h-[60px]"
                            />
                          </div>

                          {/* Mark Outreach Complete */}
                          {(() => {
                            const outreachComplete = !!selectedNiche.user_state?.outreach_complete
                            return outreachComplete ? (
                              <div
                                className="rounded-lg p-3 flex items-center justify-between"
                                style={{
                                  background: "rgba(34,197,94,0.08)",
                                  border: "0.5px solid rgba(34,197,94,0.3)",
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                  <p className="text-sm font-medium text-green-400">
                                    Outreach marked complete
                                  </p>
                                </div>
                                <button
                                  onClick={handleToggleOutreachComplete}
                                  className="text-xs text-white/40 hover:text-white/60 underline"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : (
                              <Button
                                onClick={handleToggleOutreachComplete}
                                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Mark Outreach Complete
                              </Button>
                            )
                          })()}

                          <p className="text-xs text-white/50 pt-2 border-t border-white/5">
                            Coffee Date demos and Wins are updated automatically from the Coffee Date Demo and GHL
                            tools.
                          </p>
                        </div>
                      )}
                  </div>

                  {/* Section 6 — Build Android / Coffee Date Demo */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("demo")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          getSectionStatus("demo") === "completed" ? "bg-green-500" :
                          getSectionStatus("demo") === "current" ? "bg-[#00AAFF] animate-pulse" :
                          "bg-white/20"
                        )} />
                        <span className="text-sm font-medium text-white/70">Coffee Date Demo</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.demo ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.demo && (
                      <div className="px-4 pb-4">
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-5">
                          {/* Automatic demo completion indicator — set when the user actually runs the demo in presentation mode */}
                          {selectedNiche.user_state?.coffee_date_completed && (
                            <div
                              className="rounded-lg p-3 flex items-center gap-2"
                              style={{
                                background: "rgba(34,197,94,0.08)",
                                border: "0.5px solid rgba(34,197,94,0.3)",
                              }}
                            >
                              <CheckCircle className="h-4 w-4 text-green-400" />
                              <p className="text-sm font-medium text-green-400">
                                Coffee Date Demo completed
                              </p>
                            </div>
                          )}

                          {/* Android build / run demo */}
                          <div className={cn(selectedNiche.user_state?.coffee_date_completed && "pt-4 border-t border-white/5")}>
                            {nicheAndroidCount > 0 ? (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                  <p className="text-green-400 text-sm font-medium">
                                    {nicheAndroidCount === 1
                                      ? "1 Android built for this niche"
                                      : `${nicheAndroidCount} Androids built for this niche`}
                                  </p>
                                </div>
                                <p className="text-xs text-white/50 mb-3 leading-relaxed">
                                  Open the Coffee Date Demo to run your Android with a prospect, or build another variation.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Button
                                    asChild
                                    className="flex-1 bg-[#00AAFF] hover:bg-[#0099EE] text-white font-medium"
                                  >
                                    <Link
                                      href={
                                        firstNicheAndroidId
                                          ? `/demo/${firstNicheAndroidId}?type=client&niche=${encodeURIComponent(selectedNiche.niche_name)}`
                                          : "/demo"
                                      }
                                    >
                                      {nicheAndroidCount > 1 ? "Open latest Coffee Date Demo" : "Open Coffee Date Demo"}
                                      <ChevronRight className="h-4 w-4 ml-1" />
                                    </Link>
                                  </Button>
                                  {nicheAndroidCount > 1 && (
                                    <Button
                                      asChild
                                      variant="ghost"
                                      className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                                    >
                                      <Link href="/demo">
                                        See all {nicheAndroidCount} Androids
                                      </Link>
                                    </Button>
                                  )}
                                  <Button
                                    asChild
                                    variant="ghost"
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                                  >
                                    <Link href={`/prompt-generator?niche=${encodeURIComponent(selectedNiche.niche_name)}`}>
                                      Build another Android
                                    </Link>
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-white/70 font-medium mb-1">
                                  Next step: build your Android
                                </p>
                                <p className="text-xs text-white/50 mb-3 leading-relaxed">
                                  Your Android is what powers the Coffee Date Demo. Build one tailored to this niche so
                                  prospects experience the value instantly on the call.
                                </p>
                                <Button
                                  asChild
                                  className="w-full bg-white/10 hover:bg-white/15 text-white border border-white/15"
                                >
                                  <Link href={`/prompt-generator?niche=${encodeURIComponent(selectedNiche.niche_name)}`}>
                                    Build Android for this niche
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                  </Link>
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 7 — GHL / Revival */}
                  <div className="border border-white/10 rounded-lg mb-2">
                    <button
                      onClick={() => toggleSection("revival")}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          getSectionStatus("revival") === "completed" ? "bg-green-500" :
                          getSectionStatus("revival") === "current" ? "bg-[#00AAFF] animate-pulse" :
                          "bg-white/20"
                        )} />
                        <span className="text-sm font-medium text-white/70">Revival</span>
                      </div>
                      <svg 
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        style={{ transform: expandedSections.revival ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                      >
                        <path d="M3 5l4 4 4-4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    {expandedSections.revival && (
                      <div className="px-4 pb-4">
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3">
                          {selectedNiche.user_state?.ghl_connected ? (
                            <p className="text-green-400 text-sm">GHL connected — revival active</p>
                          ) : (
                            <>
                              <p className="text-sm text-white/50 mb-3">
                                Connect GoHighLevel to activate dead lead revival for this niche
                              </p>
                              <Button
                                asChild
                                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                              >
<Link href="/revival">
  Connect GHL account
                                  <ChevronRight className="h-4 w-4 ml-1" />
                                </Link>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  
                      </>
                    )
                  })()}
                </Card>
              ) : (
                <Card className="border border-white/10 bg-zinc-900/50 h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-[#00AAFF]/10 flex items-center justify-center mb-4">
                    <Target className="h-8 w-8 text-[#00AAFF]/60" />
                  </div>
                  <h3 className="text-lg font-medium text-white">Choose a niche to see why it works and start outreach</h3>
                  <p className="text-sm text-white/50 mt-2 max-w-sm">
                    Select a niche from the list to understand why it could be a great opportunity and take action immediately.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        <Dialog open={showCoffeeDateModal} onOpenChange={setShowCoffeeDateModal}>
          <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                {coffeeDateStep === "type"
                  ? "How would you classify this Coffee Date session?"
                  : "Which niche was this demo for?"}
              </DialogTitle>
              <DialogDescription className="text-white/60">
                {coffeeDateStep === "type"
                  ? "Select whether this was a test or a real client demo"
                  : "Select the niche to update its pipeline status"}
              </DialogDescription>
            </DialogHeader>

            {coffeeDateStep === "type" ? (
              <div className="flex flex-col gap-3 py-4">
                <Button
                  onClick={() => {
                    setShowCoffeeDateModal(false)
                    toast({
                      title: "Test Session",
                      description: "No pipeline changes made",
                    })
                  }}
                  variant="outline"
                  className="h-16 border-zinc-600 text-white hover:bg-white/10"
                >
                  <div className="text-left">
                    <div className="font-semibold">Test Only</div>
                    <div className="text-sm text-white/60">Practice session, no pipeline update</div>
                  </div>
                </Button>
                <Button
                  onClick={() => {
                    setCoffeeDateType("client")
                    setCoffeeDateStep("niche")
                  }}
                  className="h-16 bg-[#00A8FF] hover:bg-[#00A8FF]/90"
                >
                  <div className="text-left">
                    <div className="font-semibold">Client Demo</div>
                    <div className="text-sm text-white/80">Real demo, update niche pipeline</div>
                  </div>
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search niches..."
                    value={coffeeDateNicheSearch}
                    onChange={(e) => setCoffeeDateNicheSearch(e.target.value)}
                    className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-white/40"
                  />
                </div>

                <ScrollArea className="h-[300px] rounded-lg border border-zinc-700 bg-zinc-800">
                  <div className="p-2 space-y-1">
                    {/* Pre-select current niche if available */}
                    {selectedNiche && (
                      <button
                        onClick={() => handleCoffeeDateComplete(selectedNiche.id, selectedNiche.niche_name)}
                        className="w-full text-left p-3 rounded-lg bg-[#00A8FF]/20 border border-[#00A8FF]/50 hover:bg-[#00A8FF]/30 transition-colors"
                      >
                        <div className="font-medium text-white">{selectedNiche.niche_name}</div>
                        <div className="text-sm text-white/60">{selectedNiche.industry_name} (currently selected)</div>
                      </button>
                    )}

                    {/* Other option */}
                    <button
                      onClick={() => handleCoffeeDateComplete(null, "Other")}
                      className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors border border-zinc-600"
                    >
                      <div className="font-medium text-white">Other</div>
                      <div className="text-sm text-white/60">Not in the list</div>
                    </button>

                    {/* Filtered niches */}
                    {allNiches
                      .filter(
                        (n) =>
                          n.id !== selectedNiche?.id &&
                          (n.niche_name.toLowerCase().includes(coffeeDateNicheSearch.toLowerCase()) ||
                            n.industry_name.toLowerCase().includes(coffeeDateNicheSearch.toLowerCase())),
                      )
                      .slice(0, 20)
                      .map((niche) => (
                        <button
                          key={niche.id}
                          onClick={() => handleCoffeeDateComplete(niche.id, niche.niche_name)}
                          className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors"
                        >
                          <div className="font-medium text-white">{niche.niche_name}</div>
                          <div className="text-sm text-white/60">{niche.industry_name}</div>
                        </button>
                      ))}
                  </div>
                </ScrollArea>

                <Button
                  variant="outline"
                  onClick={() => {
                    setCoffeeDateStep("type")
                    setCoffeeDateType(null)
                  }}
                  className="w-full border-zinc-600 text-white hover:bg-white/10"
                >
                  Back
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={showWinModal} onOpenChange={setShowWinModal}>
          <DialogContent className="sm:max-w-[500px] bg-zinc-900 border-zinc-700">
            <DialogHeader>
              <DialogTitle className="text-white">Mark as Win</DialogTitle>
              <DialogDescription className="text-white/60">Confirm which niche to mark as a win</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  placeholder="Search niches..."
                  value={winNicheSearch}
                  onChange={(e) => setWinNicheSearch(e.target.value)}
                  className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-white/40"
                />
              </div>

              <ScrollArea className="h-[300px] rounded-lg border border-zinc-700 bg-zinc-800">
                <div className="p-2 space-y-1">
                  {/* Pre-select current niche if available */}
                  {selectedNiche && (
                    <button
                      onClick={() => handleWinComplete(selectedNiche.id, selectedNiche.niche_name)}
                      className="w-full text-left p-3 rounded-lg bg-green-500/20 border border-green-500/50 hover:bg-green-500/30 transition-colors"
                    >
                      <div className="font-medium text-white">{selectedNiche.niche_name}</div>
                      <div className="text-sm text-white/60">{selectedNiche.industry_name} (currently selected)</div>
                    </button>
                  )}

                  {/* Other option */}
                  <button
                    onClick={() => handleWinComplete(null, "Other")}
                    className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors border border-zinc-600"
                  >
                    <div className="font-medium text-white">Other</div>
                    <div className="text-sm text-white/60">Not in the list</div>
                  </button>

                  {/* Filtered niches */}
                  {allNiches
                    .filter(
                      (n) =>
                        n.id !== selectedNiche?.id &&
                        (n.niche_name.toLowerCase().includes(winNicheSearch.toLowerCase()) ||
                          n.industry_name.toLowerCase().includes(winNicheSearch.toLowerCase())),
                    )
                    .slice(0, 20)
                    .map((niche) => (
                      <button
                        key={niche.id}
                        onClick={() => handleWinComplete(niche.id, niche.niche_name)}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <div className="font-medium text-white">{niche.niche_name}</div>
                        <div className="text-sm text-white/60">{niche.industry_name}</div>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
