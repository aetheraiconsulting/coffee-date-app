"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useUserState } from "@/context/StateContext"
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = [
  {
    id: "headline",
    title: "Your Headline",
    description: "What's the bold promise you make to clients?",
    placeholder: "e.g., 'I help gyms reactivate 50+ dead leads in 30 days using AI'",
    field: "headline",
    required: true,
  },
  {
    id: "subheadline",
    title: "Supporting Statement",
    description: "Add context or credibility to your headline (optional)",
    placeholder: "e.g., 'Without hiring staff or spending on ads'",
    field: "subheadline",
    required: false,
  },
  {
    id: "problem",
    title: "The Problem You Solve",
    description: "What pain point does your ideal client face?",
    placeholder: "e.g., 'Most gyms have hundreds of leads sitting in their CRM that never converted. They're leaving money on the table.'",
    field: "problem",
    required: true,
    multiline: true,
  },
  {
    id: "solution",
    title: "Your Solution",
    description: "How do you solve this problem?",
    placeholder: "e.g., 'I use AI-powered conversations to re-engage dormant leads and book them into your calendar automatically.'",
    field: "solution",
    required: true,
    multiline: true,
  },
  {
    id: "proof",
    title: "Proof or Credibility",
    description: "Why should they trust you? (optional)",
    placeholder: "e.g., 'I've helped 12 gym owners book 200+ calls in the last 90 days'",
    field: "proof",
    required: false,
    multiline: true,
  },
  {
    id: "cta",
    title: "Your Call to Action",
    description: "What do you want them to do next?",
    placeholder: "e.g., 'Book a 15-minute call to see it in action'",
    field: "cta",
    required: true,
  },
]

export default function OfferBuilderPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { refreshState } = useUserState()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    headline: "",
    subheadline: "",
    problem: "",
    solution: "",
    proof: "",
    cta: "",
  })

  const currentStepData = STEPS[currentStep]
  const isLastStep = currentStep === STEPS.length - 1
  const isFirstStep = currentStep === 0

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const canProceed = () => {
    const step = STEPS[currentStep]
    if (!step.required) return true
    return formData[step.field as keyof typeof formData]?.trim().length > 0
  }

  const handleNext = () => {
    if (!canProceed()) {
      toast({
        title: "Required Field",
        description: "Please fill in this field before continuing.",
        variant: "destructive",
      })
      return
    }
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (!canProceed()) {
      toast({
        title: "Required Field",
        description: "Please fill in this field before continuing.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save offer")
      }

      // Refresh state to update mission state
      await refreshState()

      toast({
        title: "Offer Created!",
        description: "Your offer has been saved. Now let's start outreach.",
      })

      // Redirect to outreach
      router.push("/revival")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save offer. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate progress
  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen bg-[#080B0F] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-[#00AAFF]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#00AAFF]">
              Offer Builder
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Build Your Irresistible Offer
          </h1>
          <p className="text-white/60">
            Answer these questions to craft your client-winning pitch
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-white/60">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            <span className="text-white/40">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00AAFF] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep
            const isCurrent = index === currentStep
            const hasValue = formData[step.field as keyof typeof formData]?.trim().length > 0

            return (
              <button
                key={step.id}
                onClick={() => {
                  // Allow clicking to previous steps or completed steps
                  if (index <= currentStep || hasValue) {
                    setCurrentStep(index)
                  }
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                  isCurrent
                    ? "bg-[#00AAFF] text-white"
                    : isCompleted || hasValue
                    ? "bg-white/10 text-white/80 hover:bg-white/20"
                    : "bg-white/5 text-white/40 cursor-not-allowed"
                )}
              >
                {isCompleted || hasValue ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <span className="h-3 w-3 flex items-center justify-center text-[10px]">
                    {index + 1}
                  </span>
                )}
                {step.title}
              </button>
            )
          })}
        </div>

        {/* Current Step Card */}
        <Card className="border border-white/10 bg-white/[0.03] rounded-xl mb-8">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">
                  {currentStepData.title}
                  {currentStepData.required && (
                    <span className="text-[#00AAFF] ml-1">*</span>
                  )}
                </h2>
                <p className="text-white/60">{currentStepData.description}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor={currentStepData.field} className="sr-only">
                  {currentStepData.title}
                </Label>
                {currentStepData.multiline ? (
                  <Textarea
                    id={currentStepData.field}
                    value={formData[currentStepData.field as keyof typeof formData]}
                    onChange={(e) =>
                      handleInputChange(currentStepData.field, e.target.value)
                    }
                    placeholder={currentStepData.placeholder}
                    className="min-h-[150px] bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20 text-base"
                    autoFocus
                  />
                ) : (
                  <Input
                    id={currentStepData.field}
                    value={formData[currentStepData.field as keyof typeof formData]}
                    onChange={(e) =>
                      handleInputChange(currentStepData.field, e.target.value)
                    }
                    placeholder={currentStepData.placeholder}
                    className="h-12 bg-white/[0.05] border-white/10 text-white placeholder:text-white/30 focus:border-[#00AAFF] focus:ring-[#00AAFF]/20 text-base"
                    autoFocus
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
            className={cn(
              "border-white/20 text-white hover:bg-white/10",
              isFirstStep && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !canProceed()}
              className="bg-[#00AAFF] hover:bg-[#0099EE] text-white shadow-lg shadow-[#00AAFF]/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Save & Start Outreach
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
            >
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Preview Section */}
        {(formData.headline || formData.problem || formData.solution) && (
          <div className="mt-12">
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-4">
              Live Preview
            </h3>
            <Card className="border border-[#00AAFF]/20 bg-[#00AAFF]/5 rounded-xl">
              <CardContent className="p-6 space-y-4">
                {formData.headline && (
                  <h4 className="text-xl font-bold text-white">{formData.headline}</h4>
                )}
                {formData.subheadline && (
                  <p className="text-white/70 text-sm">{formData.subheadline}</p>
                )}
                {formData.problem && (
                  <div>
                    <span className="text-xs text-[#00AAFF] uppercase tracking-wider">
                      Problem
                    </span>
                    <p className="text-white/80 mt-1">{formData.problem}</p>
                  </div>
                )}
                {formData.solution && (
                  <div>
                    <span className="text-xs text-[#00AAFF] uppercase tracking-wider">
                      Solution
                    </span>
                    <p className="text-white/80 mt-1">{formData.solution}</p>
                  </div>
                )}
                {formData.proof && (
                  <div>
                    <span className="text-xs text-[#00AAFF] uppercase tracking-wider">
                      Proof
                    </span>
                    <p className="text-white/80 mt-1">{formData.proof}</p>
                  </div>
                )}
                {formData.cta && (
                  <Button className="bg-[#00AAFF] hover:bg-[#0099EE] text-white mt-4">
                    {formData.cta}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
