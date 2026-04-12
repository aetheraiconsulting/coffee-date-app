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
import { useRouter } from "next/navigation"

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
}

type ViewState = "notes" | "generating" | "proposal"

export default function ProposalBuilderPage() {
  const [view, setView] = useState<ViewState>("notes")
  const [offer, setOffer] = useState<Offer | null>(null)
  const [callScript, setCallScript] = useState<CallScript | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [prospectName, setProspectName] = useState("")
  const [prospectBusiness, setProspectBusiness] = useState("")
  const [additionalContext, setAdditionalContext] = useState("")

  const { toast } = useToast()
  const supabase = createClient()
  const { refreshState } = useUserState()
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch offer
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

      // Fetch most recent completed call script
      const { data: scriptData } = await supabase
        .from("call_scripts")
        .select("id, call_notes")
        .eq("user_id", user.id)
        .eq("call_completed", true)
        .order("call_completed_at", { ascending: false })
        .limit(1)
        .single()

      if (scriptData) setCallScript(scriptData)

      // Check for existing unsent proposal
      const { data: existingProposal } = await supabase
        .from("proposals")
        .select("*")
        .eq("user_id", user.id)
        .eq("sent", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (existingProposal) {
        setProposal(existingProposal)
        setView("proposal")
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
      const { error } = await supabase
        .from("proposals")
        .update({
          sent: true,
          sent_at: new Date().toISOString(),
        })
        .eq("id", proposal.id)

      if (error) throw error

      await refreshState()

      toast({
        title: "Proposal marked as sent",
        description: "Great work! Track your deal in the pipeline.",
      })

      router.push("/dashboard")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
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
      </div>
    </div>
  )
}
