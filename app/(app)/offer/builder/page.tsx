"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Sparkles, ChevronRight, CheckCircle2 } from "lucide-react"
import { useUserState } from "@/context/StateContext"

// Popular niches for the dropdown
const NICHES = [
  "Real Estate Agents",
  "Insurance Brokers",
  "Financial Advisors",
  "Mortgage Brokers",
  "Auto Dealerships",
  "Home Services",
  "Medical Practices",
  "Dental Offices",
  "Law Firms",
  "Fitness Studios",
  "Salons & Spas",
  "Restaurants",
  "E-commerce",
  "SaaS Companies",
  "Marketing Agencies",
  "Coaches & Consultants",
  "Other",
]

const INDUSTRIES = [
  "Real Estate",
  "Finance & Insurance",
  "Healthcare",
  "Legal",
  "Home Services",
  "Fitness & Wellness",
  "Beauty & Personal Care",
  "Food & Hospitality",
  "Retail & E-commerce",
  "Technology",
  "Professional Services",
  "Education",
  "Other",
]

interface GeneratedOffer {
  id: string
  headline: string
  subheadline: string | null
  problem: string | null
  solution: string | null
  proof: string | null
  cta: string | null
  niche: string
  industry: string
}

export default function OfferBuilderPage() {
  const router = useRouter()
  const { refreshState } = useUserState()
  
  const [step, setStep] = useState<"input" | "generating" | "preview">("input")
  const [niche, setNiche] = useState("")
  const [customNiche, setCustomNiche] = useState("")
  const [industry, setIndustry] = useState("")
  const [customIndustry, setCustomIndustry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [offer, setOffer] = useState<GeneratedOffer | null>(null)

  const effectiveNiche = niche === "Other" ? customNiche : niche
  const effectiveIndustry = industry === "Other" ? customIndustry : industry
  const canGenerate = effectiveNiche && effectiveIndustry

  const handleGenerate = async () => {
    if (!canGenerate) return

    setStep("generating")
    setError(null)

    try {
      const response = await fetch("/api/offers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: effectiveNiche,
          industry: effectiveIndustry,
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
              {/* Niche Selection */}
              <div className="space-y-2">
                <Label className="text-white">Who do you want to help?</Label>
                <Select value={niche} onValueChange={setNiche}>
                  <SelectTrigger className="bg-white/[0.05] border-white/10 text-white h-12">
                    <SelectValue placeholder="Select a niche..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    {NICHES.map((n) => (
                      <SelectItem key={n} value={n} className="text-white hover:bg-white/10">
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {niche === "Other" && (
                  <Input
                    placeholder="Enter your niche..."
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    className="bg-white/[0.05] border-white/10 text-white h-12 mt-2"
                  />
                )}
              </div>

              {/* Industry Selection */}
              <div className="space-y-2">
                <Label className="text-white">What industry are they in?</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger className="bg-white/[0.05] border-white/10 text-white h-12">
                    <SelectValue placeholder="Select an industry..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-white/10">
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i} className="text-white hover:bg-white/10">
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {industry === "Other" && (
                  <Input
                    placeholder="Enter the industry..."
                    value={customIndustry}
                    onChange={(e) => setCustomIndustry(e.target.value)}
                    className="bg-white/[0.05] border-white/10 text-white h-12 mt-2"
                  />
                )}
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
                AI is crafting a compelling offer tailored to {effectiveNiche} in the {effectiveIndustry} industry.
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
                {/* Headline */}
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {offer.headline}
                  </h2>
                  {offer.subheadline && (
                    <p className="text-white/70 text-lg">
                      {offer.subheadline}
                    </p>
                  )}
                </div>

                {/* Problem */}
                {offer.problem && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      The Problem
                    </p>
                    <p className="text-white/80">{offer.problem}</p>
                  </div>
                )}

                {/* Solution */}
                {offer.solution && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      The Solution
                    </p>
                    <p className="text-white/80">{offer.solution}</p>
                  </div>
                )}

                {/* Proof */}
                {offer.proof && (
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">
                      Why It Works
                    </p>
                    <p className="text-white/70 italic">{offer.proof}</p>
                  </div>
                )}

                {/* CTA Preview */}
                {offer.cta && (
                  <div className="pt-4 border-t border-white/10">
                    <div className="inline-flex items-center justify-center px-6 py-3 bg-[#00AAFF] text-white font-semibold rounded-lg">
                      {offer.cta}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Niche/Industry Tags */}
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                {offer.niche}
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">
                {offer.industry}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleRegenerate}
                className="flex-1 border-white/20 text-white hover:bg-white/10 h-12"
              >
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
