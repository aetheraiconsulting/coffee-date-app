"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Sparkles, CheckCircle2, RefreshCw, DollarSign, Shield, Target, Lock, AlertTriangle } from "lucide-react"
import { useUserState } from "@/context/StateContext"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type PricingModel = "50_profit_share" | "custom_profit_share" | "pay_per_lead" | "pay_per_conversation" | "retainer"

interface GeneratedOffer {
  id?: string
  niche: string
  service_name: string
  outcome_statement: string
  price_point: string
  pricing_model: string
  guarantee: string
  confidence_score: "strong" | "needs_work" | "weak"
  confidence_reason: string
}

const PRICING_MODELS: { value: PricingModel; label: string }[] = [
  { value: "50_profit_share", label: "50% Profit Share" },
  { value: "custom_profit_share", label: "Custom Profit Share" },
  { value: "pay_per_lead", label: "Pay Per Lead" },
  { value: "pay_per_conversation", label: "Pay Per Conversation" },
  { value: "retainer", label: "Retainer" },
]

const LOCKED_GUARANTEES: Record<PricingModel, string> = {
  "50_profit_share": "You only pay when we deliver results — zero risk to you.",
  "custom_profit_share": "You only pay when we deliver results — zero risk to you.",
  "pay_per_lead": "You only pay for leads we deliver — zero upfront cost.",
  "pay_per_conversation": "You only pay for conversations we generate — zero upfront cost.",
  "retainer": "",
}

export default function OfferBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshState } = useUserState()
  const supabase = createClient()
  
  // Form inputs
  const [nicheInput, setNicheInput] = useState("")
  const [problemInput, setProblemInput] = useState("")
  const [outcomeInput, setOutcomeInput] = useState("")
  
  // State management
  const [step, setStep] = useState<"input" | "generating" | "preview" | "saved">("input")
  const [error, setError] = useState<string | null>(null)
  const [preloaded, setPreloaded] = useState(false)
  const [autoGenerate, setAutoGenerate] = useState(false)
  
  // Editable offer fields
  const [serviceName, setServiceName] = useState("")
  const [outcomeStatement, setOutcomeStatement] = useState("")
  const [pricingModel, setPricingModel] = useState<PricingModel>("50_profit_share")
  const [priceValue, setPriceValue] = useState("50")
  const [guarantee, setGuarantee] = useState("")
  const [confidenceScore, setConfidenceScore] = useState<"strong" | "needs_work" | "weak">("strong")
  const [confidenceReason, setConfidenceReason] = useState("")
  const [niche, setNiche] = useState("")
  
  // Editing states
  const [editingServiceName, setEditingServiceName] = useState(false)
  const [editingOutcome, setEditingOutcome] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pre-fill from URL params and auto-generate if all present
  useEffect(() => {
    const nicheParam = searchParams.get("niche")
    const problemParam = searchParams.get("problem")
    const outcomeParam = searchParams.get("outcome")
    
    if (nicheParam) {
      setNicheInput(nicheParam)
      setNiche(nicheParam)
      setPreloaded(true)
    }
    if (problemParam) {
      setProblemInput(problemParam)
    }
    if (outcomeParam) {
      setOutcomeInput(outcomeParam)
    }
    
    // Auto-generate if all three params present
    if (nicheParam && problemParam && outcomeParam) {
      setAutoGenerate(true)
    }
  }, [searchParams])

  // Load existing active offer when opened without URL params
  useEffect(() => {
    const nicheParam = searchParams.get("niche")
    const problemParam = searchParams.get("problem")
    
    if (!nicheParam && !problemParam) {
      const loadExistingOffer = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        
        const { data } = await supabase
          .from("offers")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle()
        
        if (data) {
          setServiceName(data.service_name || "")
          setOutcomeStatement(data.outcome_statement || "")
          setPricingModel(data.pricing_model || "50_profit_share")
          // Parse price value from formatted price_point
          const priceMatch = data.price_point?.match(/\d+/)
          if (priceMatch) setPriceValue(priceMatch[0])
          setGuarantee(data.guarantee || "")
          setNiche(data.niche || "")
          setConfidenceScore(data.confidence_score || "strong")
          setConfidenceReason(data.confidence_reason || "")
          setStep("preview")
        }
      }
      loadExistingOffer()
    }
  }, [searchParams, supabase])

  // Trigger auto-generation
  useEffect(() => {
    if (autoGenerate && nicheInput && problemInput && outcomeInput) {
      handleGenerate()
      setAutoGenerate(false)
    }
  }, [autoGenerate, nicheInput, problemInput, outcomeInput])

  // Update guarantee when pricing model changes
  useEffect(() => {
    if (pricingModel !== "retainer") {
      setGuarantee(LOCKED_GUARANTEES[pricingModel])
    }
    // Reset price value based on model
    if (pricingModel === "50_profit_share") {
      setPriceValue("50")
    } else if (pricingModel === "custom_profit_share") {
      setPriceValue("30")
    } else if (pricingModel === "pay_per_lead") {
      setPriceValue("50")
    } else if (pricingModel === "pay_per_conversation") {
      setPriceValue("25")
    } else if (pricingModel === "retainer") {
      setPriceValue("1000")
      setGuarantee("")
    }
  }, [pricingModel])

  const isGuaranteeLocked = pricingModel !== "retainer"
  const canSave = pricingModel !== "retainer" || guarantee.trim().length > 0
  const canGenerate = nicheInput.trim() && problemInput.trim() && outcomeInput.trim()

  const handleGenerate = async () => {
    if (!canGenerate) return

    setStep("generating")
    setError(null)

    try {
      const response = await fetch("/api/offers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: nicheInput.trim(),
          problem: problemInput.trim(),
          outcome: outcomeInput.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate offer")
      }

      const data = await response.json()
      const offer: GeneratedOffer = data.offer
      
      // Populate editable fields
      setServiceName(offer.service_name)
      setOutcomeStatement(offer.outcome_statement)
      setConfidenceScore(offer.confidence_score)
      setConfidenceReason(offer.confidence_reason)
      setNiche(offer.niche)
      
      // Set default pricing model and guarantee
      setPricingModel("50_profit_share")
      setPriceValue("50")
      setGuarantee(LOCKED_GUARANTEES["50_profit_share"])
      
      setStep("preview")
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong"
      setError(errorMessage)
      setStep("input")
    }
  }

  const handleSave = async () => {
    if (!canSave) return
    
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const pricePointFormatted = formatPricePoint()
      
      // Check if user already has an active offer
      const { data: existingOffer } = await supabase
        .from("offers")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle()

      if (existingOffer) {
        // Update the existing active offer
        const { error: updateError } = await supabase
          .from("offers")
          .update({
            service_name: serviceName,
            outcome_statement: outcomeStatement,
            price_point: pricePointFormatted,
            guarantee,
            confidence_score: confidenceScore,
            confidence_reason: confidenceReason,
            pricing_model: pricingModel,
            niche,
          })
          .eq("id", existingOffer.id)

        if (updateError) throw updateError
      } else {
        // Insert new offer
        const { data: newOffer, error: insertError } = await supabase
          .from("offers")
          .insert({
            user_id: user.id,
            service_name: serviceName,
            outcome_statement: outcomeStatement,
            price_point: pricePointFormatted,
            guarantee,
            confidence_score: confidenceScore,
            confidence_reason: confidenceReason,
            pricing_model: pricingModel,
            niche,
            is_active: true,
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Update profiles.offer_id with new offer id
        await supabase
          .from("profiles")
          .update({ offer_id: newOffer.id })
          .eq("id", user.id)
      }

      await refreshState()
      setStep("saved")
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save offer"
      setError(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = () => {
    handleGenerate()
  }

  const formatPricePoint = () => {
    switch (pricingModel) {
      case "50_profit_share":
        return `${priceValue}% of net profit recovered`
      case "custom_profit_share":
        return `${priceValue}% of net profit recovered`
      case "pay_per_lead":
        return `$${priceValue} per qualified lead booked`
      case "pay_per_conversation":
        return `$${priceValue} per conversation generated`
      case "retainer":
        return `$${priceValue}/month`
      default:
        return priceValue
    }
  }

  const getConfidenceDisplay = (score: "strong" | "needs_work" | "weak") => {
    switch (score) {
      case "strong":
        return { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", label: "Strong" }
      case "needs_work":
        return { color: "text-amber-400 bg-amber-400/10 border-amber-400/30", label: "Needs Work" }
      case "weak":
        return { color: "text-red-400 bg-red-400/10 border-red-400/30", label: "Weak" }
      default:
        return { color: "text-white/60 bg-white/10 border-white/20", label: score }
    }
  }

  // Auto-generating state (all params present)
  if (autoGenerate || (step === "generating" && searchParams.get("niche") && searchParams.get("problem") && searchParams.get("outcome"))) {
    return (
      <div className="min-h-screen bg-black p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-[#00AAFF]/20 rounded-full blur-xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-[#00AAFF]/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-[#00AAFF] animate-spin" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Generating your offer for {nicheInput}...
              </h2>
              <p className="text-white/60">
                AI is crafting a compelling service offer tailored to your niche.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-[#00AAFF]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00AAFF]">
              Offer Builder
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Build Your Offer</h1>
          <p className="text-white/60">
            Tell us who you want to help, and AI will generate a compelling offer for you.
          </p>
        </div>

        {/* Step: Input */}
        {step === "input" && (
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-6 space-y-6">
              {preloaded && (
                <div className="p-3 bg-[#00AAFF]/10 border border-[#00AAFF]/30 rounded-lg">
                  <p className="text-[#00AAFF] text-sm">
                    Niche pre-loaded from your opportunities. Add the outcome you deliver and generate your offer.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-white">Your niche</Label>
                <Input
                  placeholder="e.g. local restaurants, estate agents, fitness coaches"
                  value={nicheInput}
                  onChange={(e) => setNicheInput(e.target.value)}
                  className="bg-white/[0.05] border-white/10 text-white h-12"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">The problem you fix</Label>
                <Input
                  placeholder="e.g. they lose leads because they don't follow up fast enough"
                  value={problemInput}
                  onChange={(e) => setProblemInput(e.target.value)}
                  className="bg-white/[0.05] border-white/10 text-white h-12"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">The outcome you deliver</Label>
                <Input
                  placeholder="e.g. booked appointments within 48 hours using AI follow-up"
                  value={outcomeInput}
                  onChange={(e) => setOutcomeInput(e.target.value)}
                  className="bg-white/[0.05] border-white/10 text-white h-12"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 shadow-lg shadow-[#00AAFF]/30"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate My Offer
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Generating */}
        {step === "generating" && (
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-12 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-[#00AAFF]/20 rounded-full blur-xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-[#00AAFF]/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-[#00AAFF] animate-spin" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Generating Your Offer...
              </h2>
              <p className="text-white/60">
                AI is crafting a compelling offer tailored to {nicheInput}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step: Preview (Editable) */}
        {step === "preview" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Offer Generated — Click any field to edit</span>
            </div>

            <Card className="bg-gradient-to-br from-[#00AAFF]/10 to-transparent border-[#00AAFF]/30 overflow-hidden">
              <CardContent className="p-6 space-y-6">
                {/* Service Name - Editable */}
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-[#00AAFF] font-semibold">
                    Your Service
                  </p>
                  {editingServiceName ? (
                    <Input
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      onBlur={() => setEditingServiceName(false)}
                      autoFocus
                      className="text-2xl font-bold bg-white/[0.05] border-white/20 text-white"
                    />
                  ) : (
                    <h2
                      onClick={() => setEditingServiceName(true)}
                      className="text-2xl font-bold text-white leading-tight cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2 transition-colors"
                    >
                      {serviceName}
                    </h2>
                  )}
                </div>

                {/* Outcome Statement - Editable */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-white/40" />
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Outcome
                    </p>
                  </div>
                  {editingOutcome ? (
                    <Textarea
                      value={outcomeStatement}
                      onChange={(e) => setOutcomeStatement(e.target.value)}
                      onBlur={() => setEditingOutcome(false)}
                      autoFocus
                      className="bg-white/[0.05] border-white/20 text-white text-lg"
                      rows={3}
                    />
                  ) : (
                    <p
                      onClick={() => setEditingOutcome(true)}
                      className="text-white/90 text-lg leading-relaxed cursor-pointer hover:bg-white/5 rounded px-2 py-1 -mx-2 transition-colors"
                    >
                      {outcomeStatement}
                    </p>
                  )}
                </div>

                {/* Pricing Model Selector */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-white/40" />
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Pricing Model
                    </p>
                  </div>
                  <Select value={pricingModel} onValueChange={(v) => setPricingModel(v as PricingModel)}>
                    <SelectTrigger className="bg-white/[0.05] border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                      {PRICING_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value} className="text-white hover:bg-white/10">
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Point - Dynamic Format */}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                    Price Point
                  </p>
                  <div className="flex items-center gap-2">
                    {pricingModel === "50_profit_share" && (
                      <>
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={priceValue}
                          onChange={(e) => setPriceValue(e.target.value)}
                          className="w-20 bg-white/[0.05] border-white/20 text-white text-lg font-semibold"
                        />
                        <span className="text-white/70">% of net profit recovered</span>
                      </>
                    )}
                    {pricingModel === "custom_profit_share" && (
                      <>
                        <Input
                          type="number"
                          min="1"
                          max="99"
                          value={priceValue}
                          onChange={(e) => setPriceValue(e.target.value)}
                          className="w-20 bg-white/[0.05] border-white/20 text-white text-lg font-semibold"
                        />
                        <span className="text-white/70">% of net profit recovered</span>
                      </>
                    )}
                    {pricingModel === "pay_per_lead" && (
                      <>
                        <span className="text-white/70">$</span>
                        <Input
                          type="number"
                          min="1"
                          value={priceValue}
                          onChange={(e) => setPriceValue(e.target.value)}
                          className="w-24 bg-white/[0.05] border-white/20 text-white text-lg font-semibold"
                        />
                        <span className="text-white/70">per qualified lead booked</span>
                      </>
                    )}
                    {pricingModel === "pay_per_conversation" && (
                      <>
                        <span className="text-white/70">$</span>
                        <Input
                          type="number"
                          min="1"
                          value={priceValue}
                          onChange={(e) => setPriceValue(e.target.value)}
                          className="w-24 bg-white/[0.05] border-white/20 text-white text-lg font-semibold"
                        />
                        <span className="text-white/70">per conversation generated</span>
                      </>
                    )}
                    {pricingModel === "retainer" && (
                      <>
                        <span className="text-white/70">$</span>
                        <Input
                          type="number"
                          min="1"
                          value={priceValue}
                          onChange={(e) => setPriceValue(e.target.value)}
                          className="w-28 bg-white/[0.05] border-white/20 text-white text-lg font-semibold"
                        />
                        <span className="text-white/70">/month</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Guarantee - Locked or Editable */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-white/40" />
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Guarantee
                    </p>
                    {isGuaranteeLocked && (
                      <Lock className="h-3 w-3 text-white/40" />
                    )}
                  </div>
                  
                  {/* Retainer Warning Banner */}
                  {pricingModel === "retainer" && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-amber-400 text-sm">
                        You have switched to a retainer model. You must define your guarantee before continuing.
                      </p>
                    </div>
                  )}
                  
                  {isGuaranteeLocked ? (
                    <p className="text-white/80 bg-white/5 rounded-lg px-4 py-3 border border-white/10">
                      {guarantee}
                    </p>
                  ) : (
                    <Textarea
                      value={guarantee}
                      onChange={(e) => setGuarantee(e.target.value)}
                      placeholder="Define your guarantee — what happens if results are not delivered?"
                      className="bg-white/[0.05] border-white/20 text-white"
                      rows={3}
                    />
                  )}
                </div>

                {/* Confidence Score - Read Only */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1 mr-4">
                      <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                        Confidence Score
                      </p>
                      <p className="text-sm text-white/60">
                        {confidenceReason}
                      </p>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-bold uppercase tracking-wider",
                      getConfidenceDisplay(confidenceScore).color
                    )}>
                      {getConfidenceDisplay(confidenceScore).label}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Niche Tag */}
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                {niche}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleSave}
                disabled={!canSave || saving}
                title={!canSave ? "Add your guarantee to continue" : undefined}
                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 shadow-lg shadow-[#00AAFF]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save offer"
                )}
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleRegenerate}
                className="w-full text-white/70 hover:text-white hover:bg-white/10 h-10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </div>
        )}

        {/* Step: Saved */}
        {step === "saved" && (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/30">
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Offer saved.</h2>
                <p className="text-white/60 mb-6">
                  Your offer is ready. Start reaching out to prospects in your niche.
                </p>
                <Button
                  onClick={() => router.push("/outreach")}
                  className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 px-8 shadow-lg shadow-[#00AAFF]/30"
                >
                  Start outreach
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
