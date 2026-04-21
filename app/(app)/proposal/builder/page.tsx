"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Loader2,
  Sparkles,
  RefreshCw,
  Send,
  FileText,
  Target,
  DollarSign,
  Shield,
  ArrowRight,
  CheckCircle2,
  ListChecks,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

type Offer = {
  service_name: string
  outcome_statement: string
  price_point: string
}

type CallScript = {
  id: string
  call_notes: string | null
}

type Proposal = {
  id: string
  problem_summary: string
  solution_summary: string
  deliverables: string
  investment: string
  guarantee: string
  next_step: string
  confidence_score: "strong" | "needs_work" | "weak"
  confidence_reason: string
  sent: boolean
  sent_at?: string | null
  prospect_business?: string | null
  deal_status?: "pending" | "won" | "lost" | null
  deal_updated_at?: string | null
}

type ViewState = "notes" | "generating" | "proposal"

export default function ProposalBuilderPage() {
  const [view, setView] = useState<ViewState>("notes")
  const [offer, setOffer] = useState<Offer | null>(null)
  const [callScript, setCallScript] = useState<CallScript | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // Form state
  const [prospectName, setProspectName] = useState("")
  const [prospectBusiness, setProspectBusiness] = useState("")
  const [additionalContext, setAdditionalContext] = useState("")

  const { toast } = useToast()
  const supabase = createClient()
  const { refreshState } = useUserState()
  const router = useRouter()
  const searchParams = useSearchParams()
  const proposalIdParam = searchParams?.get("id") ?? null
  const modeParam = searchParams?.get("mode") ?? null
  const callIdParam = searchParams?.get("call_id") ?? null

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalIdParam, modeParam, callIdParam])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Always load the active offer for context/display
      const { data: profile } = await supabase
        .from("profiles")
        .select("offer_id")
        .eq("id", user.id)
        .single()

      if (profile?.offer_id) {
        const { data: offerData } = await supabase
          .from("offers")
          .select("service_name, outcome_statement, price_point")
          .eq("id", profile.offer_id)
          .single()

        if (offerData) setOffer(offerData)
      }

      // Load call script: either the one specified via ?call_id= or the most recent completed one
      if (callIdParam) {
        const { data: scriptData } = await supabase
          .from("call_scripts")
          .select("id, call_notes")
          .eq("user_id", user.id)
          .eq("id", callIdParam)
          .maybeSingle()
        if (scriptData) setCallScript(scriptData)
      } else {
        const { data: scriptData } = await supabase
          .from("call_scripts")
          .select("id, call_notes")
          .eq("user_id", user.id)
          .eq("call_completed", true)
          .order("call_completed_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (scriptData) setCallScript(scriptData)
      }

      // Branch 1: ?mode=new — force empty form view
      if (modeParam === "new") {
        setProposal(null)
        setView("notes")
        return
      }

      // Branch 2: ?id=<proposalId> — load that specific proposal
      if (proposalIdParam) {
        const { data: specific } = await supabase
          .from("proposals")
          .select("*")
          .eq("id", proposalIdParam)
          .eq("user_id", user.id)
          .maybeSingle()

        if (specific) {
          setProposal(specific)
          setView("proposal")
          return
        }
        // If not found, fall through to default (most recent)
      }

      // Default: load the most recent proposal (sent or unsent)
      const { data: existingProposal } = await supabase
        .from("proposals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingProposal) {
        setProposal(existingProposal)
        setView("proposal")
      } else {
        setProposal(null)
        setView("notes")
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateProposal = async () => {
    setView("generating")

    try {
      const res = await fetch("/api/proposal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect_name: prospectName || undefined,
          prospect_business: prospectBusiness || undefined,
          additional_context: additionalContext || undefined,
        }),
      })

      const data = await res.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setProposal(data.proposal)
      setView("proposal")

      toast({
        title: "Proposal generated",
        description: "Review and edit your proposal before sending.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      setView("notes")
    }
  }

  const regenerateProposal = async () => {
    if (proposal) {
      await supabase.from("proposals").delete().eq("id", proposal.id)
    }
    setProposal(null)
    await generateProposal()
  }

  const updateProposalField = (field: keyof Proposal, value: string) => {
    if (!proposal) return
    setProposal({ ...proposal, [field]: value })
  }

  const saveProposalField = async (field: keyof Proposal, value: string) => {
    if (!proposal) return
    await supabase
      .from("proposals")
      .update({ [field]: value })
      .eq("id", proposal.id)
  }

  const markAsSent = async () => {
    if (!proposal) return

    try {
      const sentAt = new Date().toISOString()
      const { error } = await supabase
        .from("proposals")
        .update({
          sent: true,
          sent_at: sentAt,
          deal_status: proposal.deal_status ?? "pending",
        })
        .eq("id", proposal.id)

      if (error) throw error

      // Update local state so the Won/Lost UI appears without a reload
      setProposal({ ...proposal, sent: true, sent_at: sentAt, deal_status: proposal.deal_status ?? "pending" })

      await refreshState()

      toast({
        title: "Proposal marked as sent",
        description: "Mark the outcome below once you hear back.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const handleMarkDealStatus = async (status: "won" | "lost" | "pending") => {
    if (!proposal?.id) return
    setUpdating(true)

    const updatedAt = new Date().toISOString()
    const { error } = await supabase
      .from("proposals")
      .update({
        deal_status: status,
        deal_updated_at: updatedAt,
      })
      .eq("id", proposal.id)

    if (!error) {
      setProposal({ ...proposal, deal_status: status, deal_updated_at: updatedAt })
      await refreshState()

      if (status === "won") {
        toast({
          title: "Congratulations on the win",
          description: "This deal has been added to your clients.",
        })
      } else if (status === "lost") {
        toast({
          title: "Noted.",
          description: "Keep going. The next one is always closer.",
        })
      }
    } else {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }

    setUpdating(false)
  }

  const getConfidenceDisplay = (score: string) => {
    switch (score) {
      case "strong":
        return {
          label: "Strong proposal",
          color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        }
      case "needs_work":
        return {
          label: "Needs work",
          color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        }
      case "weak":
        return {
          label: "Weak proposal",
          color: "bg-red-500/10 text-red-400 border-red-500/30",
        }
      default:
        return {
          label: score,
          color: "bg-white/10 text-white/60 border-white/20",
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/40" />
      </div>
    )
  }

  // NOTES VIEW
  if (view === "notes") {
    return (
      <div className="min-h-screen bg-[#080B0F]">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Link
            href="/proposal"
            className="text-white/40 hover:text-white/60 text-sm flex items-center gap-1 mb-6 transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            All proposals
          </Link>

          {/* Offer Summary Card */}
          {offer && (
            <div
              className="mb-8 p-5 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              <p
                className="text-[11px] uppercase tracking-wider mb-2 font-semibold"
                style={{ color: "#00AAFF" }}
              >
                Your Offer
              </p>
              <h3 className="text-lg font-semibold text-white mb-1">
                {offer.service_name}
              </h3>
              <p className="text-sm text-white/60 mb-2">{offer.outcome_statement}</p>
              <p className="text-sm text-white/40">{offer.price_point}</p>
            </div>
          )}

          {/* Call Notes Card */}
          <div
            className="mb-8 p-5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <p
              className="text-[11px] uppercase tracking-wider mb-2 font-semibold"
              style={{ color: "#00AAFF" }}
            >
              Your Call Notes
            </p>
            <p className="text-sm text-white/50 whitespace-pre-wrap">
              {callScript?.call_notes || "No notes from your call — you can add context below."}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Build your proposal
              </h1>
              <p className="text-white/60">
                Claude will write a client-ready proposal based on your call and offer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Prospect name</Label>
                <Input
                  placeholder="e.g. James at Riverstone Fitness"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70 text-sm">Prospect business</Label>
                <Input
                  placeholder="e.g. Riverstone Fitness, Manchester"
                  value={prospectBusiness}
                  onChange={(e) => setProspectBusiness(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70 text-sm">Anything else to include?</Label>
              <Textarea
                placeholder="e.g. they mentioned budget concerns, they want to start next month"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
              />
            </div>

            <Button
              onClick={generateProposal}
              className="w-full bg-[#00AAFF] hover:bg-[#00AAFF]/90 text-white h-12"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Build my proposal
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // GENERATING VIEW
  if (view === "generating") {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-white animate-pulse">
            Claude is writing your proposal...
          </h1>
          <p className="text-white/50">This takes about 15 seconds.</p>
          <Loader2 className="h-8 w-8 animate-spin text-[#00AAFF] mx-auto" />
        </div>
      </div>
    )
  }

  // PROPOSAL VIEW
  if (!proposal) return null

  const confidenceDisplay = getConfidenceDisplay(proposal.confidence_score)

  const sections = [
    { key: "problem_summary", label: "The Problem", icon: Target },
    { key: "solution_summary", label: "Our Solution", icon: FileText },
    { key: "deliverables", label: "What's Included", icon: ListChecks },
    { key: "investment", label: "Investment", icon: DollarSign },
    { key: "guarantee", label: "Our Guarantee", icon: Shield },
    { key: "next_step", label: "Next Step", icon: ArrowRight },
  ] as const

  return (
    <div className="min-h-screen bg-[#080B0F]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link
          href="/proposal"
          className="text-white/40 hover:text-white/60 text-sm flex items-center gap-1 mb-6 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          All proposals
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">Your proposal</h1>
          <div className="text-right">
            <div
              className={cn(
                "inline-block px-3 py-1.5 rounded-lg border text-sm font-medium",
                confidenceDisplay.color
              )}
            >
              {confidenceDisplay.label}
            </div>
            <p className="text-xs text-white/40 mt-2 max-w-[200px]">
              {proposal.confidence_reason}
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {sections.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="rounded-xl p-5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-[#00AAFF]" />
                <p
                  className="text-[11px] uppercase tracking-wider font-semibold"
                  style={{ color: "#00AAFF" }}
                >
                  {label}
                </p>
              </div>
              <Textarea
                value={proposal[key]}
                onChange={(e) => updateProposalField(key, e.target.value)}
                onBlur={(e) => saveProposalField(key, e.target.value)}
                className="bg-[#080B0F] border-white/10 text-white min-h-[100px] resize-none"
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        {!proposal.sent && (
          <div className="flex items-center gap-4 mt-8">
            <Button
              onClick={markAsSent}
              className="flex-1 bg-[#00AAFF] hover:bg-[#00AAFF]/90 text-white h-12"
            >
              <Send className="mr-2 h-4 w-4" />
              Mark as sent
            </Button>
            <Button
              onClick={regenerateProposal}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/5"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
          </div>
        )}

        {/* Deal Outcome — only shown after proposal is marked as sent */}
        {proposal.sent && (
          <div style={{ marginTop: "32px" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "0.5px solid rgba(255,255,255,0.1)",
                borderRadius: "14px",
                padding: "24px",
              }}
            >
              <p
                style={{
                  color: "#00AAFF",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                DEAL OUTCOME
              </p>
              <p style={{ color: "white", fontSize: "18px", fontWeight: 700, margin: "0 0 6px" }}>
                How did this proposal land?
              </p>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: "0 0 20px" }}>
                Mark the outcome to keep your pipeline accurate.
              </p>

              {(proposal.deal_status ?? "pending") === "pending" && (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleMarkDealStatus("won")}
                    disabled={updating}
                    style={{
                      background: "#22c55e",
                      color: "#000",
                      fontWeight: 800,
                      fontSize: "14px",
                      padding: "14px 28px",
                      borderRadius: "10px",
                      border: "none",
                      cursor: updating ? "not-allowed" : "pointer",
                      opacity: updating ? 0.6 : 1,
                      flex: 1,
                      minWidth: "140px",
                    }}
                  >
                    ✓ Mark as Won
                  </button>
                  <button
                    onClick={() => handleMarkDealStatus("lost")}
                    disabled={updating}
                    style={{
                      background: "transparent",
                      color: "rgba(255,255,255,0.5)",
                      fontWeight: 600,
                      fontSize: "14px",
                      padding: "14px 28px",
                      borderRadius: "10px",
                      border: "0.5px solid rgba(255,255,255,0.15)",
                      cursor: updating ? "not-allowed" : "pointer",
                      opacity: updating ? 0.6 : 1,
                      flex: 1,
                      minWidth: "140px",
                    }}
                  >
                    Mark as Lost
                  </button>
                </div>
              )}

              {proposal.deal_status === "won" && (
                <div
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "0.5px solid rgba(34,197,94,0.3)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <p style={{ color: "#22c55e", fontWeight: 700, fontSize: "15px", margin: "0 0 4px" }}>
                    ✓ Deal Won
                  </p>
                  <p style={{ color: "rgba(34,197,94,0.6)", fontSize: "13px", margin: 0 }}>
                    {proposal.prospect_business ? `${proposal.prospect_business} — ` : ""}
                    marked won on{" "}
                    {new Date(
                      proposal.deal_updated_at || proposal.sent_at || new Date().toISOString(),
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <button
                    onClick={() => handleMarkDealStatus("pending")}
                    disabled={updating}
                    style={{
                      background: "transparent",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "12px",
                      padding: "8px 0 0",
                      border: "none",
                      cursor: updating ? "not-allowed" : "pointer",
                      textDecoration: "underline",
                      marginTop: "8px",
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}

              {proposal.deal_status === "lost" && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "0.5px solid rgba(239,68,68,0.3)",
                    borderRadius: "10px",
                    padding: "16px",
                  }}
                >
                  <p style={{ color: "#ef4444", fontWeight: 700, fontSize: "15px", margin: "0 0 4px" }}>
                    Deal Lost
                  </p>
                  <p style={{ color: "rgba(239,68,68,0.6)", fontSize: "13px", margin: 0 }}>
                    {proposal.prospect_business ? `${proposal.prospect_business} — ` : ""}
                    no worries, next one is always closer
                  </p>
                  <button
                    onClick={() => handleMarkDealStatus("pending")}
                    disabled={updating}
                    style={{
                      background: "transparent",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "12px",
                      padding: "8px 0 0",
                      border: "none",
                      cursor: updating ? "not-allowed" : "pointer",
                      textDecoration: "underline",
                      marginTop: "8px",
                    }}
                  >
                    Undo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
