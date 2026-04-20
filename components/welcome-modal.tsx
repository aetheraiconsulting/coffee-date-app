"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Coffee, Target, Send, Loader2 } from "lucide-react"

type WelcomeModalProps = {
  open: boolean
  userId: string
  onComplete: () => void
}

export function WelcomeModal({ open, userId, onComplete }: WelcomeModalProps) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const steps = [
    {
      icon: Target,
      title: "Welcome to Aether Revive",
      body: "You have 14 days to land your first AI client. We'll guide you every step of the way — one action at a time.",
      cta: "Let's get started",
    },
    {
      icon: Send,
      title: "Your 14-day sprint starts now",
      body: "Each day, Mission Control will tell you exactly what to do next. Pick a niche, build an offer, send outreach, run demos, close clients. No guesswork.",
      cta: "Show me how",
    },
    {
      icon: Coffee,
      title: "The Coffee Date Demo",
      body: "Our signature play: a 10-minute live AI demo that turns replies into paying clients. You'll run your first one within the first week.",
      cta: "I'm ready",
    },
    {
      icon: CheckCircle2,
      title: "First stop — choose your niche",
      body: "Browse 1,300+ niches, favourite the ones that fit, and start your first opportunity. We'll handle the rest.",
      cta: "Go to Opportunities",
    },
  ]

  const current = steps[step]
  const Icon = current.icon
  const isLastStep = step === steps.length - 1

  const handleNext = async () => {
    if (!isLastStep) {
      setStep(step + 1)
      return
    }

    setLoading(true)
    try {
      await fetch("/api/onboarding/complete", { method: "POST" })
      onComplete()
      router.push("/revival/opportunities")
    } catch (error) {
      console.error("[v0] Failed to complete onboarding:", error)
      setLoading(false)
    }
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      await fetch("/api/onboarding/complete", { method: "POST" })
      onComplete()
    } catch (error) {
      console.error("[v0] Failed to skip onboarding:", error)
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-lg bg-[#0F1318] border border-white/10 p-0 overflow-hidden [&>button]:hidden">
        <div className="bg-gradient-to-br from-[#00AAFF]/10 to-transparent p-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#00AAFF]/15 border border-[#00AAFF]/30 mb-5">
            <Icon className="h-7 w-7 text-[#00AAFF]" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-3 text-balance">{current.title}</h2>
          <p className="text-white/60 leading-relaxed text-pretty">{current.body}</p>
        </div>

        <div className="flex items-center justify-between px-8 py-5 border-t border-white/[0.08]">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-[#00AAFF]" : i < step ? "w-1.5 bg-[#00AAFF]/50" : "w-1.5 bg-white/15"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!isLastStep && (
              <button
                onClick={handleSkip}
                disabled={loading}
                className="text-white/40 hover:text-white/60 text-sm disabled:opacity-50"
              >
                Skip tour
              </button>
            )}
            <Button
              onClick={handleNext}
              disabled={loading}
              className="bg-[#00AAFF] hover:bg-[#00AAFF]/90 text-black font-semibold"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : current.cta}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
