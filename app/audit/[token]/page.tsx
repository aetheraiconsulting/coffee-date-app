"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { AI_AUDIT_QUESTIONS as questions, getQuestionsByCategory } from "@/lib/audit-questions"

// Build categories from the question data
const categorizedQuestions = getQuestionsByCategory()
const categories = categorizedQuestions.map(([cat]) => cat)
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Building2,
  Megaphone,
  DollarSign,
  Cog,
  HeadphonesIcon,
  Brain,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface Branding {
  company_name: string | null
  logo_url: string | null
  brand_colour: string | null
}

export default function PublicAuditPage() {
  const params = useParams()
  const token = params.token as string
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)

  const [auditName, setAuditName] = useState("")
  const [teaserContent, setTeaserContent] = useState("")
  const [branding, setBranding] = useState<Branding | null>(null)

  const [currentStep, setCurrentStep] = useState(0)
  const [prospectName, setProspectName] = useState("")
  const [prospectEmail, setProspectEmail] = useState("")
  const [responses, setResponses] = useState<Record<string, string>>({})

  const brandColor = branding?.brand_colour || "#00AAFF"

  const categoryIcons: Record<string, React.ElementType> = {
    "Business Overview": Building2,
    "Marketing & Lead Generation": Megaphone,
    "Sales & Customer Journey": DollarSign,
    "Operations & Delivery": Cog,
    "Customer Service & Retention": HeadphonesIcon,
    "AI Awareness & Readiness": Brain,
  }

  const steps = [
    { label: "Your Details", icon: Building2 },
    ...categories.map((cat) => ({ label: cat, icon: categoryIcons[cat] || Building2 })),
  ]

  useEffect(() => {
    async function fetchAudit() {
      try {
        const res = await fetch(`/api/audit/public/${token}`)
        if (!res.ok) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        setAuditName(data.name || "AI Readiness Audit")
        setTeaserContent(data.teaser_content || "")
        setBranding(data.branding)
        if (data.already_submitted) {
          setAlreadySubmitted(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    fetchAudit()
  }, [token])

  const currentCategoryQuestions =
    currentStep === 0
      ? []
      : questions.filter((q) => q.category === categories[currentStep - 1])

  const completion = Math.round(
    (Object.values(responses).filter((v) => v && v.trim()).length / questions.length) * 100
  )

  async function handleSubmit() {
    if (!prospectName.trim() || !prospectEmail.trim()) {
      toast({ title: "Please enter your name and email", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/audit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          prospect_name: prospectName,
          prospect_email: prospectEmail,
          responses,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Submission failed")
      }

      setSubmitted(true)
      toast({ title: "Audit submitted successfully!" })
    } catch (error) {
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <Card className="bg-black/40 border-white/10 max-w-md">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Audit Not Found</h1>
            <p className="text-white/50">This audit link is invalid or has expired.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <Card className="bg-black/40 border-white/10 max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: brandColor }} />
            <h1 className="text-2xl font-bold text-white mb-2">Already Submitted</h1>
            <p className="text-white/50">
              This audit has already been completed. Thank you for your responses!
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#080B0F] flex items-center justify-center">
        <Card className="bg-black/40 border-white/10 max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: brandColor }} />
            <h1 className="text-2xl font-bold text-white mb-2">Thank You!</h1>
            <p className="text-white/50 mb-4">
              Your AI Readiness Audit has been submitted successfully.
            </p>
            <p className="text-white/60 text-sm">
              {branding?.company_name || "We"} will review your responses and be in touch soon.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080B0F]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding?.logo_url ? (
              <Image
                src={branding.logo_url}
                alt={branding.company_name || "Logo"}
                width={40}
                height={40}
                className="rounded-lg object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-lg font-bold text-white">{auditName}</h1>
              {branding?.company_name && (
                <p className="text-xs text-white/50">by {branding.company_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/60">{completion}% complete</span>
            <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${completion}%`, backgroundColor: brandColor }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Steps */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28 space-y-1">
              {steps.map((step, idx) => {
                const Icon = step.icon
                const isActive = currentStep === idx
                const isComplete = idx < currentStep

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentStep(idx)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
                      isActive
                        ? "bg-white/10 border border-white/20"
                        : "hover:bg-white/5",
                      isComplete && "text-white/60"
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        isActive ? "text-white" : "text-white/40"
                      )}
                      style={isActive ? { backgroundColor: brandColor } : { backgroundColor: "rgba(255,255,255,0.05)" }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive ? "text-white" : "text-white/60"
                      )}
                    >
                      {step.label}
                    </span>
                    {isComplete && (
                      <CheckCircle2 className="h-4 w-4 ml-auto" style={{ color: brandColor }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Teaser */}
            {teaserContent && currentStep === 0 && (
              <Card className="bg-black/40 border-white/10">
                <CardContent className="p-6">
                  <p className="text-white/70 whitespace-pre-wrap">{teaserContent}</p>
                </CardContent>
              </Card>
            )}

            {/* Step 0: Contact Details */}
            {currentStep === 0 ? (
              <Card className="bg-black/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Your Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-white/70">Your Name *</Label>
                    <Input
                      value={prospectName}
                      onChange={(e) => setProspectName(e.target.value)}
                      placeholder="John Smith"
                      className="bg-white/5 border-white/10 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70">Email Address *</Label>
                    <Input
                      type="email"
                      value={prospectEmail}
                      onChange={(e) => setProspectEmail(e.target.value)}
                      placeholder="john@company.com"
                      className="bg-white/5 border-white/10 text-white mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Question Steps */
              <Card className="bg-black/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">{categories[currentStep - 1]}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {currentCategoryQuestions.map((q) => (
                    <div key={q.id}>
                      <Label className="text-white/70 text-sm">{q.question}</Label>
                      {q.type === "textarea" ? (
                        <Textarea
                          value={responses[q.id] || ""}
                          onChange={(e) =>
                            setResponses({ ...responses, [q.id]: e.target.value })
                          }
                          placeholder="Type your answer..."
                          className="bg-white/5 border-white/10 text-white mt-2"
                          rows={3}
                        />
                      ) : (
                        <Input
                          value={responses[q.id] || ""}
                          onChange={(e) =>
                            setResponses({ ...responses, [q.id]: e.target.value })
                          }
                          placeholder="Type your answer..."
                          className="bg-white/5 border-white/10 text-white mt-2"
                        />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  style={{ backgroundColor: brandColor }}
                  className="text-white hover:opacity-90"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !prospectName.trim() || !prospectEmail.trim()}
                  style={{ backgroundColor: brandColor }}
                  className="text-white hover:opacity-90"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Submit Audit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
