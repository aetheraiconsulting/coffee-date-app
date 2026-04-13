"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Save,
  ArrowLeft,
  Download,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Building2,
  Megaphone,
  DollarSign,
  Cog,
  HeadphonesIcon,
  Brain,
  Sparkles,
  Lightbulb,
  Target,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  FileText,
  Loader2,
  ExternalLink,
  Trash2,
  Link2,
  Copy,
  X,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { useToast } from "@/hooks/use-toast"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { AI_AUDIT_QUESTIONS, getQuestionsByCategory, type AuditQuestion } from "@/lib/audit-questions"

const STEP_ICONS: Record<string, React.ElementType> = {
  "Business Overview": Building2,
  "Marketing & Lead Generation": Megaphone,
  "Sales & Customer Journey": DollarSign,
  "Operations & Delivery": Cog,
  "Customer Service & Retention": HeadphonesIcon,
  "AI Awareness & Readiness": Brain,
}

interface Niche {
  id: string
  niche_name: string
  industry?: { name: string }
}

interface Bottleneck {
  issue: string
  evidence: string
  impact: string
}

interface QuickWin {
  action: string
  timeline: string
  outcome: string
}

interface RoadmapPhase {
  phase: string
  focus: string
  outcome: string
}

interface ServiceRecommendation {
  service: string
  priority: "critical" | "high" | "medium"
  problem_solved: string
  expected_outcome: string
  pricing_model: string
  why_now: string
  included?: boolean
}

interface EditedInsights {
  executive_summary: string
  bottlenecks: Bottleneck[]
  quick_wins: QuickWin[]
  roadmap: RoadmapPhase[]
  financial_impact: string
  service_recommendations: ServiceRecommendation[]
}

type ViewState = "questions" | "generating" | "review" | "complete"

function AuditBuilderContent() {
  const [auditId, setAuditId] = useState<string | null>(null)
  const [auditName, setAuditName] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [selectedNiche, setSelectedNiche] = useState<string>("other")
  const [businessSize, setBusinessSize] = useState("")
  const [responses, setResponses] = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<AuditQuestion[]>(AI_AUDIT_QUESTIONS)
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [niches, setNiches] = useState<Niche[]>([])
  const [nicheSearch, setNicheSearch] = useState("")
  const [showAIInsights, setShowAIInsights] = useState(false)
  const [aiInsights, setAiInsights] = useState<{
    bottlenecks: string[]
    quickWins: string[]
    roadmap: string[]
    financialImpact: string
  } | null>(null)
  const [view, setView] = useState<ViewState>("questions")
  const [editedInsights, setEditedInsights] = useState<EditedInsights | null>(null)
  const editedInsightsTimeout = useRef<NodeJS.Timeout>()
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [teaserContent, setTeaserContent] = useState("")
  const [generatingShareLink, setGeneratingShareLink] = useState(false)

  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const autoSaveTimeout = useRef<NodeJS.Timeout>()

  const categorizedQuestions = getQuestionsByCategory()
  const steps = [
    { name: "Business Info", icon: Building2 },
    ...categorizedQuestions.map(([category]) => ({
      name: category,
      icon: STEP_ICONS[category] || FileText,
    })),
  ]

  // Load audit if editing
  useEffect(() => {
    const id = searchParams?.get("id")
    if (id) {
      setAuditId(id)
      loadAudit(id)
    } else {
      setLoading(false)
    }
    loadNiches()
  }, [searchParams])

  async function loadNiches() {
    const { data } = await supabase
      .from("niches")
      .select("id, niche_name, industry:industries(name)")
      .order("niche_name")
    if (data) setNiches(data as Niche[])
  }

  async function loadAudit(id: string) {
    try {
      const { data, error } = await supabase.from("audits").select("*").eq("id", id).single()

      if (error) throw error

      if (data) {
        setAuditName(data.name)
        setWebsiteUrl(data.website_url || "")
        setSelectedNiche(data.niche_id || "other")
        setBusinessSize(data.business_size || "")
        setResponses(data.responses || {})
        if (data.ai_insights) setAiInsights(data.ai_insights)
        if (data.edited_insights) {
          setEditedInsights(data.edited_insights)
          setView("review")
        }
      }
    } catch (error) {
      console.error("Error loading audit:", error)
      toast({ title: "Error", description: "Failed to load audit", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  // Auto-save functionality
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)
    autoSaveTimeout.current = setTimeout(() => {
      handleSave(true)
    }, 10000) // Auto-save every 10 seconds of inactivity
  }, [auditName, responses])

  useEffect(() => {
    if (auditName && Object.keys(responses).length > 0) {
      triggerAutoSave()
    }
    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current)
    }
  }, [responses, triggerAutoSave])

  async function handleSave(isAutoSave = false) {
    if (!auditName.trim()) {
      if (!isAutoSave) {
        toast({ title: "Validation Error", description: "Please enter a business name", variant: "destructive" })
      }
      return
    }

    setSaving(true)

    try {
      const completion = calculateCompletion()
      const status = completion === 100 ? "completed" : "in_progress"

      const auditData = {
        name: auditName,
        website_url: websiteUrl,
        niche_id: selectedNiche !== "other" ? selectedNiche : null,
        business_size: businessSize,
        responses,
        completion_percentage: completion,
        status,
        ai_insights: aiInsights,
        updated_at: new Date().toISOString(),
        ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      }

      if (auditId) {
        const { error } = await supabase.from("audits").update(auditData).eq("id", auditId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("audits").insert(auditData).select().single()
        if (error) throw error
        if (data) setAuditId(data.id)
      }

      // If niche selected and completed, mark as WIN in opportunities
      if (selectedNiche !== "other" && status === "completed") {
        await markNicheAsWin(selectedNiche)
      }

      if (!isAutoSave) {
        toast({ title: "Saved", description: "Audit saved successfully" })
      }
    } catch (error) {
      console.error("Error saving audit:", error)
      if (!isAutoSave) {
        toast({ title: "Error", description: "Failed to save audit", variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  async function markNicheAsWin(nicheId: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Check if already won - don't overwrite existing win
      const { data: existingState } = await supabase
        .from("niche_user_state")
        .select("win_completed, win_type")
        .eq("niche_id", nicheId)
        .eq("user_id", user.id)
        .single()

      if (existingState?.win_completed) {
        // Already won, don't overwrite
        return
      }

      const now = new Date().toISOString()
      const { error } = await supabase.from("niche_user_state").upsert(
        {
          user_id: user.id,
          niche_id: nicheId,
          status: "Win",
          win_completed: true,
          win_completed_at: now,
          win_type: "audit", // Set win type to audit
          research_notes_added: true,
          aov_calculator_completed: true,
          customer_profile_generated: true,
          messaging_prepared: true,
          coffee_date_completed: true,
          coffee_date_completed_at: now,
          updated_at: now,
        },
        { onConflict: "niche_id,user_id" },
      )

      if (!error) {
        toast({
          title: "Win Recorded!",
          description: "This niche has been marked as a WIN in Opportunities",
        })
      }
    } catch (error) {
      console.error("Error marking niche as win:", error)
    }
  }

  function calculateCompletion() {
    const answeredQuestions = Object.values(responses).filter((v) => v && v.trim()).length
    return Math.round((answeredQuestions / questions.length) * 100)
  }

  async function handleExport() {
    if (!auditId) {
      toast({ title: "Save the audit first", description: "Please save before exporting", variant: "destructive" })
      return
    }

    // Check if AI insights have been generated
    if (!editedInsights && !aiInsights) {
      toast({ 
        title: "Generate AI insights first", 
        description: "Generate AI insights before exporting the report", 
        variant: "destructive" 
      })
      return
    }

    setExporting(true)
    try {
      const response = await fetch("/api/audit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId })
      })

      if (!response.ok) throw new Error("Export failed")

      const html = await response.text()
      const blob = new Blob([html], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${auditName.replace(/\s+/g, "-")}-AI-Audit-Report.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Report exported",
        description: "Open the HTML file and use File > Print > Save as PDF"
      })
    } catch {
      toast({ title: "Export failed", description: "Please try again", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  async function generateAIInsights() {
    if (!auditId) {
      // Save first to get an ID
      await handleSave(false)
      if (!auditId) {
        toast({ title: "Save the audit first", description: "Please save before generating insights", variant: "destructive" })
        return
      }
    }

    setView("generating")

    try {
      const response = await fetch("/api/audit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Generation failed")
      }

      const data = await response.json()

      // Add included flag to all recommendations
      const recommendations = (data.service_recommendations || []).map((r: ServiceRecommendation) => ({
        ...r,
        included: true
      }))

      setEditedInsights({
        executive_summary: data.executive_summary || "",
        bottlenecks: data.bottlenecks || [],
        quick_wins: data.quick_wins || [],
        roadmap: data.roadmap || [],
        financial_impact: data.financial_impact || "",
        service_recommendations: recommendations,
      })

      setView("review")
      toast({ title: "AI Insights Generated", description: "Review and edit before generating report" })
    } catch (error) {
      console.error("Generation error:", error)
      toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" })
      setView("questions")
    }
  }

  function updateEditedInsights<K extends keyof EditedInsights>(field: K, value: EditedInsights[K]) {
    if (!editedInsights) return
    setEditedInsights({ ...editedInsights, [field]: value })
  }

  function updateBottleneck(index: number, field: keyof Bottleneck, value: string) {
    if (!editedInsights) return
    const updated = [...editedInsights.bottlenecks]
    updated[index] = { ...updated[index], [field]: value }
    setEditedInsights({ ...editedInsights, bottlenecks: updated })
  }

  function updateQuickWin(index: number, field: keyof QuickWin, value: string) {
    if (!editedInsights) return
    const updated = [...editedInsights.quick_wins]
    updated[index] = { ...updated[index], [field]: value }
    setEditedInsights({ ...editedInsights, quick_wins: updated })
  }

  function updateRoadmap(index: number, field: keyof RoadmapPhase, value: string) {
    if (!editedInsights) return
    const updated = [...editedInsights.roadmap]
    updated[index] = { ...updated[index], [field]: value }
    setEditedInsights({ ...editedInsights, roadmap: updated })
  }

  function updateServiceRecommendation(index: number, field: keyof ServiceRecommendation, value: string | boolean) {
    if (!editedInsights) return
    const updated = [...editedInsights.service_recommendations]
    updated[index] = { ...updated[index], [field]: value }
    setEditedInsights({ ...editedInsights, service_recommendations: updated })
  }

  function removeServiceRecommendation(index: number) {
    if (!editedInsights) return
    const updated = editedInsights.service_recommendations.filter((_, i) => i !== index)
    setEditedInsights({ ...editedInsights, service_recommendations: updated })
  }

  async function generateReport() {
    if (!auditId) return

    try {
      const response = await fetch("/api/audit/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId })
      })

      if (!response.ok) throw new Error("Report generation failed")

      const html = await response.text()
      const blob = new Blob([html], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      
      toast({ title: "Report Generated", description: "Use File > Print > Save as PDF to download" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate report", variant: "destructive" })
    }
  }

  // Auto-save edited insights with 2 second debounce
  useEffect(() => {
    if (!auditId || !editedInsights) return
    
    if (editedInsightsTimeout.current) clearTimeout(editedInsightsTimeout.current)
    
    editedInsightsTimeout.current = setTimeout(async () => {
      await supabase
        .from("audits")
        .update({ edited_insights: editedInsights })
        .eq("id", auditId)
    }, 2000)

    return () => {
      if (editedInsightsTimeout.current) clearTimeout(editedInsightsTimeout.current)
    }
  }, [editedInsights, auditId, supabase])

  function restoreDefaultQuestions() {
    setQuestions(AI_AUDIT_QUESTIONS)
    toast({ title: "Questions Restored", description: "Default question set restored" })
  }

  async function generateShareLink() {
    if (!auditId) {
      await handleSave(false)
    }
    
    if (!auditId) {
      toast({ title: "Save the audit first", variant: "destructive" })
      return
    }

    setGeneratingShareLink(true)
    try {
      const response = await fetch("/api/audit/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId, teaser_content: teaserContent }),
      })

      if (!response.ok) throw new Error("Failed to generate share link")

      const data = await response.json()
      setShareUrl(data.share_url)
      toast({ title: "Share link generated!" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate share link", variant: "destructive" })
    } finally {
      setGeneratingShareLink(false)
    }
  }

  function copyShareLink() {
    navigator.clipboard.writeText(shareUrl)
    toast({ title: "Link copied to clipboard!" })
  }

  const completion = calculateCompletion()
  const currentCategory = currentStep === 0 ? null : categorizedQuestions[currentStep - 1]
  const filteredNiches = niches
    .filter((n) => n.niche_name.toLowerCase().includes(nicheSearch.toLowerCase()))
    .slice(0, 50)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a8bff] mx-auto" />
          <p className="text-white/60">Loading audit...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/audit">
                <Button variant="ghost" size="icon" className="hover:bg-[#3a8bff]/10 hover:text-[#3a8bff] text-white">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">{auditId ? "Edit Audit" : "New Audit"}</h1>
                <p className="text-white/60 text-sm">{auditName || "Untitled Audit"}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-white/60">Progress</p>
                <p className="text-lg font-semibold text-white">{completion}%</p>
              </div>
              <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-[#3a8bff] rounded-full transition-all" style={{ width: `${completion}%` }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowShareModal(true)}
                disabled={!auditName}
                className="border-white/20 hover:border-[#00AAFF]/60 hover:bg-[#00AAFF]/10 text-white bg-transparent"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!auditName || exporting}
                className="border-white/20 hover:border-[#3a8bff]/60 hover:bg-[#3a8bff]/10 text-white bg-transparent"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {exporting ? "Exporting..." : "Export Report"}
              </Button>
              <Button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="bg-[#3a8bff] hover:bg-[#2d6ed4] text-white shadow-lg shadow-[#3a8bff]/30"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-28 space-y-2">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isActive = currentStep === index
                const isCompleted =
                  index === 0
                    ? auditName && websiteUrl && businessSize
                    : index > 0 && categorizedQuestions[index - 1]?.[1].every((q) => responses[q.id]?.trim())

                return (
                  <button
                    key={step.name}
                    onClick={() => setCurrentStep(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      isActive
                        ? "bg-[#3a8bff]/20 border border-[#3a8bff]/50 text-white"
                        : "hover:bg-white/5 text-white/60 hover:text-white"
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? "bg-[#3a8bff]" : "bg-white/10"}`}>
                      <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-white/60"}`} />
                    </div>
                    <span className="text-sm font-medium flex-1">{step.name}</span>
                    {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </button>
                )
              })}

              {/* AI Insights Button */}
              {completion >= 60 && view === "questions" && (
                <button
                  onClick={generateAIInsights}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all bg-[#00AAFF]/20 border border-[#00AAFF]/50 text-[#00AAFF] hover:bg-[#00AAFF]/30 mt-4"
                >
                  <div className="p-2 rounded-lg bg-[#00AAFF]">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">Generate AI Audit Report</span>
                </button>
              )}

              {/* Back to Questions when in review */}
              {view === "review" && (
                <button
                  onClick={() => setView("questions")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-white/60 hover:text-white hover:bg-white/5 mt-4"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Back to Questions</span>
                </button>
              )}

              {/* Restore Defaults */}
              <button
                onClick={restoreDefaultQuestions}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all text-white/40 hover:text-white/60 hover:bg-white/5"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="text-sm">Restore Default Questions</span>
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6">
            {/* Generating View */}
            {view === "generating" && (
              <div className="text-center py-24">
                <div className="w-4 h-4 rounded-full bg-[#00AAFF] animate-pulse mx-auto mb-6" />
                <h2 className="text-xl font-semibold text-white mb-2">Claude is analysing this audit...</h2>
                <p className="text-white/50 text-sm">Reviewing 30 responses and generating recommendations</p>
              </div>
            )}

            {/* Review View */}
            {view === "review" && editedInsights && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Review AI Insights</h2>
                    <p className="text-white/50 text-sm">Edit any field before generating the final report</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={generateAIInsights}
                      className="border-white/20 hover:border-white/40 text-white"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Regenerate insights
                    </Button>
                    <Button
                      onClick={generateReport}
                      className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Generate PDF Report
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-white/40">Opens in new tab — use File &gt; Print &gt; Save as PDF to download.</p>

                {/* Executive Summary */}
                <Card className="bg-black/40 border-white/10">
                  <CardContent className="p-6">
                    <Label className="text-[10px] tracking-widest uppercase text-[#00AAFF] font-bold">Executive Summary</Label>
                    <p className="text-white/40 text-xs mb-3">Client-facing summary — edit before sending</p>
                    <Textarea
                      value={editedInsights.executive_summary}
                      onChange={(e) => updateEditedInsights("executive_summary", e.target.value)}
                      className="w-full bg-transparent border border-white/10 rounded-lg p-3 text-sm text-white min-h-[100px]"
                      rows={4}
                    />
                  </CardContent>
                </Card>

                {/* Financial Impact */}
                <Card className="bg-[#080B0F] border-[#00AAFF]/30">
                  <CardContent className="p-6">
                    <Label className="text-[10px] tracking-widest uppercase text-[#00AAFF] font-bold">Financial Impact Estimate</Label>
                    <Textarea
                      value={editedInsights.financial_impact}
                      onChange={(e) => updateEditedInsights("financial_impact", e.target.value)}
                      className="w-full bg-transparent border border-white/10 rounded-lg p-3 text-sm text-white mt-3"
                      rows={2}
                    />
                  </CardContent>
                </Card>

                {/* Bottlenecks */}
                <Card className="bg-black/40 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                      Key Bottlenecks Identified
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editedInsights.bottlenecks.map((b, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4 space-y-3 border-l-2 border-amber-500/50">
                        <div>
                          <Label className="text-xs text-white/40">Issue</Label>
                          <Input
                            value={b.issue}
                            onChange={(e) => updateBottleneck(i, "issue", e.target.value)}
                            className="bg-transparent border-white/10 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/40">Evidence</Label>
                          <Input
                            value={b.evidence}
                            onChange={(e) => updateBottleneck(i, "evidence", e.target.value)}
                            className="bg-transparent border-white/10 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/40">Impact</Label>
                          <Input
                            value={b.impact}
                            onChange={(e) => updateBottleneck(i, "impact", e.target.value)}
                            className="bg-transparent border-white/10 text-white mt-1"
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Service Recommendations */}
                <Card className="bg-black/40 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Target className="h-5 w-5 text-[#00AAFF]" />
                      Recommended AI Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editedInsights.service_recommendations.map((s, i) => (
                      <div
                        key={i}
                        className={`rounded-lg p-4 space-y-3 border-l-3 ${
                          s.priority === "critical" ? "bg-red-500/5 border-l-red-500" :
                          s.priority === "high" ? "bg-amber-500/5 border-l-amber-500" :
                          "bg-[#00AAFF]/5 border-l-[#00AAFF]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                              s.priority === "critical" ? "bg-red-500/20 text-red-400" :
                              s.priority === "high" ? "bg-amber-500/20 text-amber-400" :
                              "bg-[#00AAFF]/20 text-[#00AAFF]"
                            }`}>
                              {s.priority}
                            </span>
                            <Input
                              value={s.service}
                              onChange={(e) => updateServiceRecommendation(i, "service", e.target.value)}
                              className="bg-transparent border-none text-white font-bold text-lg p-0 h-auto focus-visible:ring-0"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/40">Include</span>
                              <Switch
                                checked={s.included !== false}
                                onCheckedChange={(checked) => updateServiceRecommendation(i, "included", checked)}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeServiceRecommendation(i)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-white/40">Problem Solved</Label>
                            <Textarea
                              value={s.problem_solved}
                              onChange={(e) => updateServiceRecommendation(i, "problem_solved", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1 text-sm"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-white/40">Expected Outcome</Label>
                            <Textarea
                              value={s.expected_outcome}
                              onChange={(e) => updateServiceRecommendation(i, "expected_outcome", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1 text-sm"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-white/40">Pricing Model</Label>
                            <Input
                              value={s.pricing_model}
                              onChange={(e) => updateServiceRecommendation(i, "pricing_model", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-white/40">Why Now</Label>
                            <Input
                              value={s.why_now}
                              onChange={(e) => updateServiceRecommendation(i, "why_now", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Quick Wins */}
                <Card className="bg-black/40 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-emerald-400" />
                      Quick Wins
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editedInsights.quick_wins.map((q, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4 space-y-3 border-l-2 border-emerald-500/50">
                        <div>
                          <Label className="text-xs text-white/40">Action</Label>
                          <Input
                            value={q.action}
                            onChange={(e) => updateQuickWin(i, "action", e.target.value)}
                            className="bg-transparent border-white/10 text-white mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-white/40">Timeline</Label>
                            <Input
                              value={q.timeline}
                              onChange={(e) => updateQuickWin(i, "timeline", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-white/40">Outcome</Label>
                            <Input
                              value={q.outcome}
                              onChange={(e) => updateQuickWin(i, "outcome", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Roadmap */}
                <Card className="bg-black/40 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#00AAFF]" />
                      90-Day Implementation Roadmap
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editedInsights.roadmap.map((r, i) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4 space-y-3 border-l-2 border-[#00AAFF]/50">
                        <div>
                          <Label className="text-xs text-white/40">Phase</Label>
                          <Input
                            value={r.phase}
                            onChange={(e) => updateRoadmap(i, "phase", e.target.value)}
                            className="bg-transparent border-white/10 text-white mt-1 font-semibold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-white/40">Focus</Label>
                            <Textarea
                              value={r.focus}
                              onChange={(e) => updateRoadmap(i, "focus", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1"
                              rows={2}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-white/40">Expected Outcome</Label>
                            <Textarea
                              value={r.outcome}
                              onChange={(e) => updateRoadmap(i, "outcome", e.target.value)}
                              className="bg-transparent border-white/10 text-white mt-1"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Bottom Actions */}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setView("questions")}
                    className="border-white/20 hover:border-white/40 text-white"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Questions
                  </Button>
                  <Button
                    onClick={generateReport}
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Generate PDF Report
                  </Button>
                </div>
              </div>
            )}

            {/* Questions View */}
            {view === "questions" && (
              <>
                {/* Mobile Progress */}
                <div className="lg:hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/60">Progress</span>
                    <span className="text-sm font-semibold text-white">{completion}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#3a8bff] rounded-full transition-all" style={{ width: `${completion}%` }} />
                  </div>
                </div>

                {/* Step Content */}
                {currentStep === 0 ? (
              // Business Info Step
              <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white text-2xl flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-[#3a8bff]" />
                    Business Information
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Enter the basic details about the business being audited
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white">Business Name *</Label>
                    <Input
                      placeholder="Enter business name"
                      value={auditName}
                      onChange={(e) => setAuditName(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Website URL</Label>
                    <Input
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 h-12"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Industry / Niche</Label>
                    <Input
                      placeholder="Search niches..."
                      value={nicheSearch}
                      onChange={(e) => setNicheSearch(e.target.value)}
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 mb-2"
                    />
                    <Select value={selectedNiche} onValueChange={setSelectedNiche}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-12">
                        <SelectValue placeholder="Select a niche" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700 max-h-60">
                        <SelectItem value="other" className="text-white hover:bg-zinc-800">
                          Other
                        </SelectItem>
                        {filteredNiches.map((niche) => (
                          <SelectItem key={niche.id} value={niche.id} className="text-white hover:bg-zinc-800">
                            {niche.niche_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Business Size</Label>
                    <Select value={businessSize} onValueChange={setBusinessSize}>
                      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white h-12">
                        <SelectValue placeholder="Select business size" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="solo" className="text-white hover:bg-zinc-800">
                          Solo / Freelancer
                        </SelectItem>
                        <SelectItem value="small" className="text-white hover:bg-zinc-800">
                          Small (2-10 employees)
                        </SelectItem>
                        <SelectItem value="medium" className="text-white hover:bg-zinc-800">
                          Medium (11-50 employees)
                        </SelectItem>
                        <SelectItem value="large" className="text-white hover:bg-zinc-800">
                          Large (51-200 employees)
                        </SelectItem>
                        <SelectItem value="enterprise" className="text-white hover:bg-zinc-800">
                          Enterprise (200+ employees)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ) : (
              currentCategory && (
                // Question Steps
                <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-2xl flex items-center gap-3">
                      {(() => {
                        const Icon = STEP_ICONS[currentCategory[0]] || FileText
                        return <Icon className="h-6 w-6 text-[#3a8bff]" />
                      })()}
                      {currentCategory[0]}
                    </CardTitle>
                    <CardDescription className="text-white/60">
                      {currentCategory[1].length} questions in this section
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {currentCategory[1].map((question, qIndex) => (
                      <div key={question.id} className="space-y-3">
                        <Label className="text-white text-base font-medium flex items-start gap-2">
                          <span className="text-[#3a8bff] font-semibold">{qIndex + 1}.</span>
                          {question.question}
                        </Label>
                        {question.type === "text" ? (
                          <Input
                            placeholder="Your answer..."
                            value={responses[question.id] || ""}
                            onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
                            onBlur={() => triggerAutoSave()}
                            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 h-12"
                          />
                        ) : (
                          <Textarea
                            placeholder="Your answer..."
                            rows={4}
                            value={responses[question.id] || ""}
                            onChange={(e) => setResponses({ ...responses, [question.id]: e.target.value })}
                            onBlur={() => triggerAutoSave()}
                            className="bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40 resize-none"
                          />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className="border-white/20 hover:border-white/40 text-white"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              {currentStep < steps.length - 1 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="bg-[#3a8bff] hover:bg-[#2d6ed4] text-white"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (completion >= 60) {
                        generateAIInsights()
                      } else {
                        handleSave(false)
                        router.push("/audit")
                      }
                    }}
                    className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                  >
                    {completion >= 60 ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate AI Report
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Audit
                      </>
                    )}
                  </Button>
                )}
              </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-[#0A0E14] border-white/10 w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Share Audit Link</CardTitle>
                <p className="text-white/50 text-sm mt-1">Send this link to your client to complete the audit</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShareModal(false)}
                className="text-white/50 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Teaser Content */}
              <div>
                <Label className="text-white/70 text-sm">Intro Message (optional)</Label>
                <p className="text-white/40 text-xs mb-2">Shown to the client before they start the audit</p>
                <Textarea
                  value={teaserContent}
                  onChange={(e) => setTeaserContent(e.target.value)}
                  placeholder="Thank you for taking the time to complete this AI Readiness Audit. Your responses will help us identify opportunities to improve your business operations..."
                  className="bg-white/5 border-white/10 text-white"
                  rows={3}
                />
              </div>

              {/* Generate or Show Link */}
              {!shareUrl ? (
                <Button
                  onClick={generateShareLink}
                  disabled={generatingShareLink}
                  className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                >
                  {generatingShareLink ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  Generate Share Link
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="bg-white/5 border-white/10 text-white text-sm"
                    />
                    <Button
                      onClick={copyShareLink}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10 shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={copyShareLink}
                      className="flex-1 bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Link
                    </Button>
                    <Button
                      onClick={() => window.open(shareUrl, "_blank")}
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </div>
                  <p className="text-white/40 text-xs text-center">
                    Client responses will appear in this audit once submitted
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function AuditBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a8bff] mx-auto" />
            <p className="text-white/60">Loading audit builder...</p>
          </div>
        </div>
      }
    >
      <AuditBuilderContent />
    </Suspense>
  )
}
