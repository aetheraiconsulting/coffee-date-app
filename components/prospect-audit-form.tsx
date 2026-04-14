"use client"

import { useState, useEffect, useRef } from "react"
import { AI_AUDIT_QUESTIONS, getQuestionsByCategory } from "@/lib/audit-questions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ChevronRight, ChevronLeft, CheckCircle2, Loader2 } from "lucide-react"

interface Branding {
  logo_url?: string
  company_name?: string
  brand_colour?: string
  calendar_link?: string
}

interface ProspectAuditFormProps {
  code?: string
  subdomain?: string
}

export default function ProspectAuditForm({ code, subdomain }: ProspectAuditFormProps) {
  const [step, setStep] = useState<"loading" | "error" | "intro" | "questions" | "review" | "submitted">("loading")
  const [userId, setUserId] = useState<string | null>(null)
  const [branding, setBranding] = useState<Branding | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [prospectName, setProspectName] = useState("")
  const [prospectEmail, setProspectEmail] = useState("")
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [currentCategory, setCurrentCategory] = useState(0)
  const [auditId, setAuditId] = useState<string | null>(null)
  const [teaserContent, setTeaserContent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [starting, setStarting] = useState(false)
  
  const autoSaveTimeout = useRef<NodeJS.Timeout>()
  const categorizedQuestions = getQuestionsByCategory()
  const accentColour = branding?.brand_colour || "#00AAFF"

  // Hide any app chrome on mount (sidebar, header, navigation)
  useEffect(() => {
    const sidebar = document.querySelector("aside") ||
      document.querySelector("[data-sidebar]") ||
      document.querySelector("nav")
    const header = document.querySelector("header")

    if (sidebar) (sidebar as HTMLElement).style.display = "none"
    if (header) (header as HTMLElement).style.display = "none"
    document.body.style.overflow = "hidden"

    return () => {
      if (sidebar) (sidebar as HTMLElement).style.display = ""
      if (header) (header as HTMLElement).style.display = ""
      document.body.style.overflow = ""
    }
  }, [])

  // Fetch user data on mount
  useEffect(() => {
    async function fetchUserData() {
      try {
        const params = new URLSearchParams()
        if (code) params.set("code", code)
        if (subdomain) params.set("subdomain", subdomain)

        const response = await fetch(`/api/audit/teaser?${params}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Invalid link")
        }

        const data = await response.json()
        setUserId(data.user_id)
        setBranding(data.branding || null)
        setStep("intro")
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "This audit link is invalid or expired")
        setStep("error")
      }
    }

    fetchUserData()
  }, [code, subdomain])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!auditId || step !== "questions") return
    
    autoSaveTimeout.current = setInterval(async () => {
      await autoSave()
    }, 30000)

    return () => {
      if (autoSaveTimeout.current) clearInterval(autoSaveTimeout.current)
    }
  }, [auditId, step, responses])

  async function autoSave() {
    if (!auditId) return
    setSaving(true)
    try {
      await fetch("/api/audit/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId, responses })
      })
    } catch (error) {
      console.error("Auto-save failed:", error)
    } finally {
      setSaving(false)
    }
  }

  async function handleStart() {
    console.log("[v0] handleStart called, prospectName:", prospectName, "prospectEmail:", prospectEmail, "userId:", userId)
    if (!prospectName.trim() || !prospectEmail.trim()) {
      console.log("[v0] Name or email empty, returning early")
      return
    }
    
    setStarting(true)
    try {
      console.log("[v0] Calling /api/audit/create-from-prospect with userId:", userId)
      const response = await fetch("/api/audit/create-from-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          prospect_name: prospectName,
          prospect_email: prospectEmail,
        })
      })
      
      console.log("[v0] API response status:", response.status)
      if (!response.ok) {
        const errorData = await response.json()
        console.log("[v0] API error response:", errorData)
        throw new Error(errorData.error || "Failed to create audit")
      }
      
      const data = await response.json()
      console.log("[v0] API success, audit_id:", data.audit_id)
      setAuditId(data.audit_id)
      setStep("questions")
      console.log("[v0] Step set to questions")
    } catch (error) {
      console.error("[v0] Error starting audit:", error)
    } finally {
      setStarting(false)
    }
  }

  async function handleSubmit() {
    if (!auditId) return
    
    setSubmitting(true)
    try {
      // Save final responses
      await fetch("/api/audit/submit-prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId, responses })
      })

      // Generate teaser
      const teaserRes = await fetch("/api/audit/teaser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId })
      })
      
      if (teaserRes.ok) {
        const teaserData = await teaserRes.json()
        setTeaserContent(teaserData.teaser)
      }

      setStep("submitted")
    } catch (error) {
      console.error("Error submitting audit:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const answeredCount = Object.values(responses).filter(v => v && v.trim()).length
  const totalQuestions = AI_AUDIT_QUESTIONS.length
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100)

  // Loading State
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-[#050709] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  // Error State
  if (step === "error") {
    return (
      <div className="min-h-screen bg-[#050709] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Link not found</h2>
          <p className="text-white/50 text-sm">{errorMessage}</p>
        </div>
      </div>
    )
  }

  // Intro Step
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-[#050709] flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            {branding?.logo_url && (
              <img src={branding.logo_url} alt="" className="h-8 w-auto" />
            )}
            <span className="text-white font-semibold">{branding?.company_name || "AI Readiness Audit"}</span>
            <span className="text-white/30 text-sm ml-auto">Powered by Aether AI Lab</span>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8">
              <h1 className="text-2xl font-bold text-white mb-2">AI Readiness Audit</h1>
              <p className="text-white/50 text-sm mb-8 leading-relaxed">
                This takes 10-15 minutes. We will analyse your responses and identify where AI can make the biggest impact in your business.
              </p>

              <div className="space-y-4">
                <div>
                  <Label className="text-white/70 text-sm">Your name</Label>
                  <Input
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    placeholder="John Smith"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
                <div>
                  <Label className="text-white/70 text-sm">Your email address</Label>
                  <Input
                    type="email"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              <Button
                onClick={handleStart}
                disabled={!prospectName.trim() || !prospectEmail.trim() || starting}
                className="w-full mt-6 h-12 text-base font-semibold"
                style={{ backgroundColor: accentColour, color: "#000" }}
              >
                {starting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Start audit <ChevronRight className="h-5 w-5 ml-1" /></>
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Questions Step
  if (step === "questions") {
    const currentCategoryData = categorizedQuestions[currentCategory]
    const [categoryName, categoryQuestions] = currentCategoryData

    return (
      <div className="min-h-screen bg-[#050709] flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 px-6 py-4 sticky top-0 bg-[#050709]/95 backdrop-blur-sm z-10">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {branding?.logo_url && (
                  <img src={branding.logo_url} alt="" className="h-7 w-auto" />
                )}
                <span className="text-white/70 text-sm">{branding?.company_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {saving && <span className="text-white/40">Saving...</span>}
                <span className="text-white/50">{answeredCount}/{totalQuestions} answered</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%`, backgroundColor: accentColour }}
              />
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto">
            <p className="text-white/40 text-sm mb-2">
              Category {currentCategory + 1} of {categorizedQuestions.length}
            </p>
            <h2 className="text-xl font-bold text-white mb-8">{categoryName}</h2>

            <div className="space-y-6">
              {categoryQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Label className="text-white/80 text-sm leading-relaxed">{q.question}</Label>
                    {responses[q.id]?.trim() && (
                      <span className="text-emerald-400 text-xs flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> Answered
                      </span>
                    )}
                  </div>
                  {q.type === "textarea" ? (
                    <Textarea
                      value={responses[q.id] || ""}
                      onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                      rows={3}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="Your answer..."
                    />
                  ) : (
                    <Input
                      value={responses[q.id] || ""}
                      onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      placeholder="Your answer..."
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-10 pt-6 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setCurrentCategory(currentCategory - 1)}
                disabled={currentCategory === 0}
                className="border-white/20 text-white hover:bg-white/5"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>

              {currentCategory < categorizedQuestions.length - 1 ? (
                <Button
                  onClick={() => setCurrentCategory(currentCategory + 1)}
                  style={{ backgroundColor: accentColour, color: "#000" }}
                >
                  Next category <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => setStep("review")}
                  style={{ backgroundColor: accentColour, color: "#000" }}
                >
                  Review your answers <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Review Step
  if (step === "review") {
    return (
      <div className="min-h-screen bg-[#050709] flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 px-6 py-4 sticky top-0 bg-[#050709]/95 backdrop-blur-sm z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding?.logo_url && (
                <img src={branding.logo_url} alt="" className="h-7 w-auto" />
              )}
              <span className="text-white/70 text-sm">{branding?.company_name}</span>
            </div>
            <span className="text-white/50 text-sm">{answeredCount}/{totalQuestions} answered</span>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-2">Review your answers</h2>
            <p className="text-white/50 text-sm mb-8">
              Click on any answer to edit it before submitting.
            </p>

            {answeredCount < 20 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-8">
                <p className="text-amber-400 text-sm">
                  We recommend answering at least 20 questions for the most accurate results. You have answered {answeredCount}.
                </p>
              </div>
            )}

            <div className="space-y-8">
              {categorizedQuestions.map(([categoryName, categoryQuestions], catIdx) => (
                <div key={categoryName}>
                  <h3 className="text-white/40 text-xs uppercase tracking-wider mb-4">{categoryName}</h3>
                  <div className="space-y-4">
                    {categoryQuestions.map((q) => (
                      <div key={q.id} className="bg-white/[0.02] border border-white/10 rounded-lg p-4">
                        <p className="text-white/60 text-sm mb-2">{q.question}</p>
                        <Textarea
                          value={responses[q.id] || ""}
                          onChange={(e) => setResponses({ ...responses, [q.id]: e.target.value })}
                          rows={2}
                          className="bg-white/5 border-white/10 text-white text-sm"
                          placeholder="Not answered"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-10 pt-6 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentCategory(categorizedQuestions.length - 1)
                  setStep("questions")
                }}
                className="border-white/20 text-white hover:bg-white/5"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Go back and edit
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ backgroundColor: accentColour, color: "#000" }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Submit audit
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Submitted Step
  return (
    <div className="min-h-screen bg-[#050709] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {branding?.logo_url && (
            <img src={branding.logo_url} alt="" className="h-8 w-auto" />
          )}
          <span className="text-white font-semibold">{branding?.company_name}</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div style={{ textAlign: "center", padding: "48px 24px", maxWidth: "560px", margin: "0 auto" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: `${accentColour}15`, border: `1px solid ${accentColour}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 24px"
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L20 7" stroke={accentColour} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h2 style={{ color: "white", fontSize: "24px", fontWeight: "700", margin: "0 0 8px" }}>
            Your audit has been submitted
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: "1.6", margin: "0 0 32px" }}>
            {branding?.company_name || "Your consultant"} will review your results and be in touch within 24 hours.
          </p>

          {teaserContent && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              padding: "24px",
              marginBottom: "28px",
              textAlign: "left"
            }}>
              <p style={{ color: `${accentColour}99`, fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "10px", fontWeight: "700" }}>
                A preview of your results
              </p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "14px", lineHeight: "1.8", margin: 0 }}>
                {teaserContent}
              </p>
            </div>
          )}

          {branding?.calendar_link && (
            <a
              href={branding.calendar_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: accentColour,
                color: "#000",
                fontWeight: "600",
                fontSize: "14px",
                padding: "14px 32px",
                borderRadius: "8px",
                textDecoration: "none"
              }}
            >
              Book your results review
            </a>
          )}
        </div>
      </main>
    </div>
  )
}
