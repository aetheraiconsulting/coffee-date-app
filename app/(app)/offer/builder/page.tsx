"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, ChevronRight, CheckCircle2, RefreshCw, DollarSign, Shield, Target } from "lucide-react"
import { useUserState } from "@/context/StateContext"
import { cn } from "@/lib/utils"

interface GeneratedOffer {
  id: string
  niche: string
  service_name: string
  outcome_statement: string
  price_point: string
  pricing_model: "retainer" | "performance" | "project" | "hybrid"
  guarantee: string
  confidence_score: "strong" | "needs_work" | "weak"
  confidence_reason: string
}

export default function OfferBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshState } = useUserState()
  
  const [step, setStep] = useState<"input" | "generating" | "preview">("input")
  const [niche, setNiche] = useState("")
  const [problem, setProblem] = useState("")
  const [outcome, setOutcome] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<GeneratedOffer | null>(null)
  const [preloaded, setPreloaded] = useState(false)

  // Pre-fill from URL params
  useEffect(() => {
    const nicheParam = searchParams.get("niche")
    const problemParam = searchParams.get("problem")
    
    if (nicheParam) {
      setNiche(nicheParam)
      setPreloaded(true)
    }
    if (problemParam) {
      setProblem(problemParam)
    }
  }, [searchParams])

  const canGenerate = niche.trim() && problem.trim() && outcome.trim()

  const handleGenerate = async () => {
    if (!canGenerate) return

    setStep("generating")
    setError(null)

    try {
      const response = await fetch("/api/offers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: niche.trim(),
          problem: problem.trim(),
          outcome: outcome.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to generate offer")
      }

      const data = await response.json()
      setOffer(data.offer)
      setStep("preview")
      
      // Refresh state so mission updates
      await refreshState()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong"
      setError(errorMessage)
      setStep("input")
    }
  }

  const handleContinue = () => {
    router.push("/revival")
  }

  const handleRegenerate = () => {
    setStep("input")
    setOffer(null)
  }

  // Confidence score color and label
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
              {/* Preloaded Banner */}
              {preloaded && (
                <div className="p-3 bg-[#00AAFF]/10 border border-[#00AAFF]/30 rounded-lg">
                  <p className="text-[#00AAFF] text-sm">
                    Niche pre-loaded from your opportunities. Add the outcome you deliver and generate your offer.
                  </p>
                </div>
              )}

              {/* Niche Input */}
              <div className="space-y-2">
                <Label className="text-white">Your niche</Label>
                <Input
                  placeholder="e.g. local restaurants, estate agents, fitness coaches"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="bg-white/[0.05] border-white/10 text-white h-12"
                />
              </div>

              {/* Problem Input */}
              <div className="space-y-2">
                <Label className="text-white">The problem you fix</Label>
                <Input
                  placeholder="e.g. they lose leads because they don't follow up fast enough"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  className="bg-white/[0.05] border-white/10 text-white h-12"
                />
              </div>

              {/* Outcome Input */}
              <div className="space-y-2">
                <Label className="text-white">The outcome you deliver</Label>
                <Input
                  placeholder="e.g. booked appointments within 48 hours using AI follow-up"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  className="bg-white/[0.05] border-white/10 text-white h-12"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 shadow-lg shadow-[#00AAFF]/30"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate My Offer
              </Button>

              <p className="text-xs text-white/40 text-center">
                AI will create a tailored offer based on your selections
              </p>
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
              <p className="text-white/60 max-w-sm">
                AI is crafting a compelling offer tailored to {niche}.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step: Preview */}
        {step === "preview" && offer && (
          <div className="space-y-6">
            {/* Success Badge */}
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Offer Generated Successfully</span>
            </div>

            {/* Offer Preview Card */}
            <Card className="bg-gradient-to-br from-[#00AAFF]/10 to-transparent border-[#00AAFF]/30 overflow-hidden">
              <CardContent className="p-6 space-y-6">
                {/* Service Name */}
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-[#00AAFF] font-semibold">
                    Your Service
                  </p>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {offer.service_name}
                  </h2>
                </div>

                {/* Outcome Statement */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-white/40" />
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Outcome
                    </p>
                  </div>
                  <p className="text-white/90 text-lg leading-relaxed">
                    {offer.outcome_statement}
                  </p>
                </div>

                {/* Price Point */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-white/40" />
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Price Point
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-white font-semibold text-xl">
                      {offer.price_point}
                    </p>
                    <span className="text-xs px-2 py-1 rounded-full bg-[#00AAFF]/10 text-[#00AAFF] border border-[#00AAFF]/30 capitalize">
                      {offer.pricing_model}
                    </span>
                  </div>
                </div>

                {/* Guarantee */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-white/40" />
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Guarantee
                    </p>
                  </div>
                  <p className="text-white/80">
                    {offer.guarantee}
                  </p>
                </div>

                {/* Confidence Score */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1 mr-4">
                      <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                        Confidence Score
                      </p>
                      <p className="text-sm text-white/60">
                        {offer.confidence_reason}
                      </p>
                    </div>
                    <div className={cn(
                      "px-4 py-2 rounded-lg border text-sm font-bold uppercase tracking-wider",
                      getConfidenceDisplay(offer.confidence_score).color
                    )}>
                      {getConfidenceDisplay(offer.confidence_score).label}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Niche Tag */}
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                {offer.niche}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleRegenerate}
                className="flex-1 border-white/20 text-white hover:bg-white/10 h-12"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
              <Button
                onClick={handleContinue}
                className="flex-1 bg-[#00AAFF] hover:bg-[#0099EE] text-white font-semibold h-12 shadow-lg shadow-[#00AAFF]/30"
              >
                Continue to Outreach
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <p className="text-xs text-white/40 text-center">
              Your offer has been saved. You can always edit it later.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
