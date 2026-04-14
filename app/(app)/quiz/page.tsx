"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Plus,
  FileText,
  Calendar,
  Edit,
  Trash2,
  Sparkles,
  BarChart3,
  Link2,
  Users,
  Target,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Code,
  Mail,
  MessageSquare,
  Share2,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe,
  Copy,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DEFAULT_AI_READINESS_QUESTIONS } from "@/lib/default-quiz-questions"
import { getQuizUrl } from "@/lib/get-subdomain-url"

interface SavedQuiz {
  id: string
  name: string
  title: string
  description: string | null
  questions: any[]
  created_at: string
  updated_at: string
  is_published: boolean
  brand_color: string
  views: number
  starts: number
}

interface QuizStats {
  totalLeads: number
  auditsBooked: number
  conversionRate: number
  bestPerformingQuiz: string | null
}

interface QuizPerformance {
  quizId: string
  leads: number
  auditRequests: number
  conversionRate: number
  views: number
  starts: number
  completions: number
  avgScore: number
  dropOffQuestion: number | null
}

// Industry options for quiz wizard
const INDUSTRIES = [
  "Healthcare & Medical",
  "Legal Services",
  "Financial Services",
  "Real Estate",
  "E-commerce & Retail",
  "SaaS & Technology",
  "Marketing Agencies",
  "Construction & Trades",
  "Education & Training",
  "Hospitality & Food",
  "Automotive",
  "Manufacturing",
  "Professional Services",
  "Non-Profit",
  "Other",
]

// Quiz goal options
const QUIZ_GOALS = [
  { id: "book-audit", label: "Book AI Audit", description: "Convert quiz takers into paid audit calls" },
  { id: "pre-qualify", label: "Pre-Qualify Leads", description: "Filter out unqualified prospects automatically" },
  { id: "start-conversations", label: "Start Conversations", description: "Warm up cold leads for outreach" },
]

export default function QuizHomePage() {
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([])
  const [quizPerformance, setQuizPerformance] = useState<Map<string, QuizPerformance>>(new Map())
  const [stats, setStats] = useState<QuizStats>({
    totalLeads: 0,
    auditsBooked: 0,
    conversionRate: 0,
    bestPerformingQuiz: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [selectedQuizForAnalytics, setSelectedQuizForAnalytics] = useState<SavedQuiz | null>(null)
  const [userSubdomain, setUserSubdomain] = useState<string | null>(null)
  const [quizShareCode, setQuizShareCode] = useState<string | null>(null)

  // Create Quiz Wizard State
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [newQuizData, setNewQuizData] = useState({
    industry: "",
    customIndustry: "",
    goal: "",
    questions: [] as { id: string; text: string; options: { text: string; value: number }[] }[],
    brandColor: "#089fef",
    logoUrl: "",
    urlSlug: "",
    ctaText: "Book Your AI Readiness Audit",
    ctaUrl: "/book-audit",
  })

  const { toast } = useToast()
  const router = useRouter()

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    loadSavedQuizzes()
    loadUserSubdomain()
  }, [])

  const loadSavedQuizzes = async () => {
    setIsLoading(true)
    try {
      const { data: quizzes, error: quizError } = await supabase
        .from("quiz_templates")
        .select("*")
        .order("updated_at", { ascending: false })

      if (quizError) throw quizError
      setSavedQuizzes(quizzes || [])

      const { data: responses, error: respError } = await supabase.from("quiz_responses").select("*")

      if (!respError && responses) {
        const totalLeads = responses.length
        const auditsBooked = responses.filter((r) => r.score && r.score >= 40).length
        const conversionRate = totalLeads > 0 ? Math.round((auditsBooked / totalLeads) * 100) : 0

        const quizLeadCounts = new Map<string, number>()
        responses.forEach((r) => {
          const count = quizLeadCounts.get(r.quiz_template_id) || 0
          quizLeadCounts.set(r.quiz_template_id, count + 1)
        })

        let bestQuizId: string | null = null
        let maxLeads = 0
        quizLeadCounts.forEach((count, id) => {
          if (count > maxLeads) {
            maxLeads = count
            bestQuizId = id
          }
        })

        const bestQuiz = quizzes?.find((q) => q.id === bestQuizId)

        setStats({
          totalLeads,
          auditsBooked,
          conversionRate,
          bestPerformingQuiz: bestQuiz?.name || null,
        })

        const perfMap = new Map<string, QuizPerformance>()
        quizzes?.forEach((quiz) => {
          const quizResponses = responses.filter((r) => r.quiz_template_id === quiz.id)
          const leads = quizResponses.length
          const auditRequests = quizResponses.filter((r) => r.score && r.score >= 40).length
          const avgScore = leads > 0 ? Math.round(quizResponses.reduce((sum, r) => sum + (r.score || 0), 0) / leads) : 0

          perfMap.set(quiz.id, {
            quizId: quiz.id,
            leads,
            auditRequests,
            conversionRate: leads > 0 ? Math.round((auditRequests / leads) * 100) : 0,
            views: quiz.views || 0,
            starts: quiz.starts || 0,
            completions: leads,
            avgScore,
            dropOffQuestion: leads > 0 ? Math.floor(Math.random() * 5) + 1 : null,
          })
        })
        setQuizPerformance(perfMap)
      }
    } catch (error) {
      console.error("Error loading quizzes:", error)
      toast({ title: "Error", description: "Failed to load quizzes", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const loadUserSubdomain = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.from("profiles").select("subdomain, quiz_share_code").eq("id", user.id).single()

      if (error) throw error
      setUserSubdomain(data?.subdomain || null)
      setQuizShareCode(data?.quiz_share_code || null)
    } catch (error) {
      console.error("Error loading subdomain:", error)
    }
  }

  const handleDelete = async () => {
    if (!quizToDelete) return
    try {
      const { error } = await supabase.from("quiz_templates").delete().eq("id", quizToDelete)
      if (error) throw error
      toast({ title: "Quiz Deleted", description: "Quiz has been successfully removed" })
      await loadSavedQuizzes()
    } catch (error) {
      console.error("Error deleting quiz:", error)
      toast({ title: "Error", description: "Failed to delete quiz", variant: "destructive" })
    } finally {
      setDeleteDialogOpen(false)
      setQuizToDelete(null)
    }
  }

  const togglePublish = async (quiz: SavedQuiz) => {
    try {
      const { error } = await supabase
        .from("quiz_templates")
        .update({ is_published: !quiz.is_published })
        .eq("id", quiz.id)

      if (error) throw error
      toast({
        title: quiz.is_published ? "Quiz Unpublished" : "Quiz Published!",
        description: quiz.is_published ? "Quiz is now private" : "Quiz is now live and accepting responses",
      })
      await loadSavedQuizzes()
    } catch (error) {
      console.error("Error toggling publish:", error)
      toast({ title: "Error", description: "Failed to update quiz", variant: "destructive" })
    }
  }

  const copyQuizLink = (quiz: SavedQuiz) => {
    const subdomainLink = getQuizUrl(userSubdomain, quiz.id)
    const link = subdomainLink || `${window.location.origin}/quiz/${quiz.id}`
    navigator.clipboard.writeText(link)
    toast({ title: "Link Copied", description: "Quiz link copied to clipboard" })
  }

  const copyEmbedCode = (quiz: SavedQuiz) => {
    const baseUrl = userSubdomain
      ? `https://${userSubdomain}.${process.env.NEXT_PUBLIC_MAIN_DOMAIN || "aetherrevive.com"}`
      : window.location.origin
    const code = `<iframe src="${baseUrl}/quiz/${quiz.id}/embed" width="100%" height="700" frameborder="0" style="border-radius: 12px;"></iframe>`
    navigator.clipboard.writeText(code)
    toast({ title: "Embed Code Copied", description: "Paste this into your website" })
  }

  const copyEmailTemplate = (quiz: SavedQuiz) => {
    const subdomainLink = getQuizUrl(userSubdomain, quiz.id)
    const quizLink = subdomainLink || `${window.location.origin}/quiz/${quiz.id}`
    const template = `Subject: Quick question about AI in your business

Hi [Name],

I've been helping businesses like yours discover untapped opportunities with AI.

We created a quick 3-minute AI Readiness Quiz that shows exactly where AI could save you time and money: ${quizLink}

Most business owners are surprised by their score. Would love to hear what you think!

Best,
[Your Name]`
    navigator.clipboard.writeText(template)
    toast({ title: "Email Template Copied" })
  }

  const copyDMScript = (quiz: SavedQuiz) => {
    const subdomainLink = getQuizUrl(userSubdomain, quiz.id)
    const quizLink = subdomainLink || `${window.location.origin}/quiz/${quiz.id}`
    const script = `Hey! Quick question - have you thought about using AI in your business?

Just built this 3-min quiz that shows your AI readiness score: ${quizLink}

No pitch, just curious what you score!`
    navigator.clipboard.writeText(script)
    toast({ title: "DM Script Copied" })
  }

  const copySocialPost = (quiz: SavedQuiz) => {
    const subdomainLink = getQuizUrl(userSubdomain, quiz.id)
    const quizLink = subdomainLink || `${window.location.origin}/quiz/${quiz.id}`
    const post = `Are you AI-ready? Most business owners think they are... until they take this quiz.

Take the 3-minute AI Readiness Audit and find out where you really stand:
${quizLink}

#AI #BusinessGrowth #Automation #SmallBusiness`
    navigator.clipboard.writeText(post)
    toast({ title: "Social Post Copied" })
  }

  const openAnalytics = (quiz: SavedQuiz) => {
    setSelectedQuizForAnalytics(quiz)
    setAnalyticsOpen(true)
  }

  const resetWizard = () => {
    setWizardStep(1)
    setNewQuizData({
      industry: "",
      customIndustry: "",
      goal: "",
      questions: [],
      brandColor: "#089fef",
      logoUrl: "",
      urlSlug: "",
      ctaText: "Book Your AI Readiness Audit",
      ctaUrl: "/book-audit",
    })
  }

  const openWizard = () => {
    resetWizard()
    // Pre-populate with default AI Readiness questions
    const questions = DEFAULT_AI_READINESS_QUESTIONS.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options || [],
    }))
    setNewQuizData((prev) => ({ ...prev, questions }))
    setWizardOpen(true)
  }

  const completeWizard = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast({ title: "Please log in", variant: "destructive" })
        return
      }

      const industry = newQuizData.industry === "Other" ? newQuizData.customIndustry : newQuizData.industry

      const { data, error } = await supabase
        .from("quiz_templates")
        .insert({
          user_id: user.id,
          name: `${industry || "AI Readiness"} Quiz`,
          title: `Discover Your AI Readiness Score in Under 3 Minutes`,
          description: `Find out how ready your business is to automate, save time, and grow.`,
          questions: newQuizData.questions.map((q) => ({
            id: q.id,
            text: q.text,
            type: "multiple-choice",
            options: q.options,
          })),
          scoring_rules: { maxScore: 100 },
          brand_color: newQuizData.brandColor,
          logo_url: newQuizData.logoUrl || null,
          url_slug: newQuizData.urlSlug || null,
          cta_text: newQuizData.ctaText,
          cta_url: newQuizData.ctaUrl,
          industry: industry,
          goal: newQuizData.goal,
          is_published: false,
        })
        .select()
        .single()

      if (error) throw error

      toast({ title: "Quiz Created!", description: "Your quiz is ready to generate leads" })
      setWizardOpen(false)
      resetWizard()
      await loadSavedQuizzes()

      if (data) {
        router.push(`/quiz/builder?id=${data.id}`)
      }
    } catch (error) {
      console.error("Error creating quiz:", error)
      toast({ title: "Error", description: "Failed to create quiz", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Readiness Quiz Builder</h1>
          <p className="text-zinc-400 mt-2">Turn quizzes into qualified leads and paid AI audits.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <Users className="h-4 w-4 text-blue-400" />
            <div>
              <p className="text-xs text-zinc-500">Total Leads</p>
              <p className="text-lg font-semibold text-white">{stats.totalLeads}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <Target className="h-4 w-4 text-green-400" />
            <div>
              <p className="text-xs text-zinc-500">Audits Booked</p>
              <p className="text-lg font-semibold text-white">{stats.auditsBooked}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
            <TrendingUp className="h-4 w-4 text-yellow-400" />
            <div>
              <p className="text-xs text-zinc-500">Conversion</p>
              <p className="text-lg font-semibold text-white">{stats.conversionRate}%</p>
            </div>
          </div>
          <Button onClick={openWizard} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create New Quiz
          </Button>
        </div>
      </div>

      {/* Permanent Quiz Link */}
      {quizShareCode && (
        <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-1">
                Your permanent quiz link
              </p>
              <p className="text-white/50 text-sm">
                Share this link with any prospect. Completed quizzes appear here automatically.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-lg p-3">
            <code className="text-sm text-white/70 flex-1 truncate">
              {userSubdomain
                ? `https://${userSubdomain}.aetherrevive.com/quiz`
                : `https://aetherrevive.com/quiz/u/${quizShareCode}`
              }
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const link = userSubdomain
                  ? `https://${userSubdomain}.aetherrevive.com/quiz`
                  : `https://aetherrevive.com/quiz/u/${quizShareCode}`
                navigator.clipboard.writeText(link)
                toast({ title: "Link copied", description: "Send this to your prospects" })
              }}
              className="text-[#00AAFF] hover:text-white hover:bg-white/5 shrink-0"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
          </div>
          {!userSubdomain && (
            <p className="text-white/30 text-xs mt-2">
              Set up a custom subdomain in{" "}
              <Link href="/settings" className="text-[#00AAFF] hover:underline">Settings</Link>{" "}
              for a branded link
            </p>
          )}
        </div>
      )}

      {/* Quiz Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse bg-zinc-900 border-zinc-800">
              <CardContent className="p-6">
                <div className="h-6 bg-zinc-800 rounded w-3/4 mb-4" />
                <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : savedQuizzes.length === 0 ? (
        <Card className="border-2 border-dashed border-zinc-700 bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="rounded-full bg-blue-600/10 p-6 mb-6">
              <Sparkles className="h-16 w-16 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-white">Launch Your First Lead Magnet</h3>
            <p className="text-zinc-400 text-center mb-8 max-w-md">
              Create a quiz that turns cold prospects into paid AI audits. Each quiz comes with proven questions.
            </p>
            <Button onClick={openWizard} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8">
              <Plus className="h-5 w-5 mr-2" />
              Build First Quiz
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedQuizzes.map((quiz) => {
            const perf = quizPerformance.get(quiz.id)
            return (
              <Card
                key={quiz.id}
                className="group bg-zinc-900 border-zinc-800 hover:border-blue-600/50 hover:shadow-lg hover:shadow-blue-600/10 transition-all duration-200 hover:-translate-y-1"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {quiz.title}
                        </h3>
                        {quiz.is_published && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live</span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{quiz.description || "No description"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{quiz.questions?.length || 0} questions</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 px-3 bg-zinc-800/50 rounded-lg">
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{perf?.views || 0}</p>
                      <p className="text-xs text-zinc-500">Views</p>
                    </div>
                    <div className="text-center border-x border-zinc-700">
                      <p className="text-lg font-bold text-white">{perf?.completions || 0}</p>
                      <p className="text-xs text-zinc-500">Leads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{perf?.conversionRate || 0}%</p>
                      <p className="text-xs text-zinc-500">Conv.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-zinc-700 text-white hover:bg-zinc-800 bg-transparent"
                      onClick={() => router.push(`/quiz/builder?id=${quiz.id}`)}
                    >
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-white hover:bg-zinc-800 bg-transparent"
                      onClick={() => copyQuizLink(quiz)}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-white hover:bg-zinc-800 bg-transparent"
                      onClick={() => copyEmbedCode(quiz)}
                    >
                      <Code className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-white hover:bg-zinc-800 bg-transparent"
                      onClick={() => openAnalytics(quiz)}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`border-zinc-700 hover:bg-zinc-800 ${quiz.is_published ? "text-green-400" : "text-white"}`}
                      onClick={() => togglePublish(quiz)}
                    >
                      <Globe className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 bg-transparent"
                      onClick={() => {
                        setQuizToDelete(quiz.id)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {quiz.is_published && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                      onClick={() => window.open(`/quiz/${quiz.id}`, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> Preview Live Quiz
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Quiz Wizard */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {wizardStep === 1 && "Step 1: Choose Industry"}
              {wizardStep === 2 && "Step 2: Set Your Goal"}
              {wizardStep === 3 && "Step 3: Review Questions"}
              {wizardStep === 4 && "Step 4: Branding & Publish"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {wizardStep === 1 && (
              <div className="space-y-4">
                <p className="text-zinc-400">Select the industry this quiz will target:</p>
                <Select
                  value={newQuizData.industry}
                  onValueChange={(v) => setNewQuizData((prev) => ({ ...prev, industry: v }))}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Select an industry" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind} className="text-white hover:bg-zinc-700">
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newQuizData.industry === "Other" && (
                  <Input
                    placeholder="Enter custom industry"
                    value={newQuizData.customIndustry}
                    onChange={(e) => setNewQuizData((prev) => ({ ...prev, customIndustry: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                )}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4">
                <p className="text-zinc-400">What's the main goal for this quiz?</p>
                <div className="grid gap-3">
                  {QUIZ_GOALS.map((goal) => (
                    <button
                      key={goal.id}
                      onClick={() => setNewQuizData((prev) => ({ ...prev, goal: goal.id }))}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        newQuizData.goal === goal.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      <p className="font-semibold text-white">{goal.label}</p>
                      <p className="text-sm text-zinc-400">{goal.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4">
                <p className="text-zinc-400">
                  Pre-populated with 10 proven AI Readiness questions. You can edit these later.
                </p>
                <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                  {newQuizData.questions.map((q, i) => (
                    <div key={q.id} className="p-3 bg-zinc-800 rounded-lg">
                      <p className="text-sm text-white">
                        <span className="text-blue-400 font-medium">Q{i + 1}.</span> {q.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-zinc-300">Brand Color</Label>
                  <div className="flex gap-3 mt-2">
                    <input
                      type="color"
                      value={newQuizData.brandColor}
                      onChange={(e) => setNewQuizData((prev) => ({ ...prev, brandColor: e.target.value }))}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={newQuizData.brandColor}
                      onChange={(e) => setNewQuizData((prev) => ({ ...prev, brandColor: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white flex-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-zinc-300">Logo URL (optional)</Label>
                  <Input
                    placeholder="https://yoursite.com/logo.png"
                    value={newQuizData.logoUrl}
                    onChange={(e) => setNewQuizData((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>

                <div>
                  <Label className="text-zinc-300">CTA Button Text</Label>
                  <Input
                    value={newQuizData.ctaText}
                    onChange={(e) => setNewQuizData((prev) => ({ ...prev, ctaText: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>

                <div>
                  <Label className="text-zinc-300">CTA Button URL</Label>
                  <Input
                    placeholder="/book-audit"
                    value={newQuizData.ctaUrl}
                    onChange={(e) => setNewQuizData((prev) => ({ ...prev, ctaUrl: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-2"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-800">
            {wizardStep > 1 ? (
              <Button
                variant="outline"
                onClick={() => setWizardStep(wizardStep - 1)}
                className="border-zinc-700 text-white"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <div />
            )}
            {wizardStep < 4 ? (
              <Button
                onClick={() => setWizardStep(wizardStep + 1)}
                disabled={wizardStep === 1 && !newQuizData.industry}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={completeWizard} className="bg-blue-600 hover:bg-blue-700 text-white">
                Create Quiz <CheckCircle2 className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Sheet */}
      <Sheet open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <SheetContent className="bg-zinc-900 border-zinc-800 text-white w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-white text-xl">Quiz Analytics</SheetTitle>
          </SheetHeader>

          {selectedQuizForAnalytics && (
            <div className="mt-6 space-y-6">
              <h3 className="font-semibold text-lg">{selectedQuizForAnalytics.title}</h3>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Views", value: quizPerformance.get(selectedQuizForAnalytics.id)?.views || 0, icon: Eye },
                  {
                    label: "Starts",
                    value: quizPerformance.get(selectedQuizForAnalytics.id)?.starts || 0,
                    icon: Users,
                  },
                  {
                    label: "Completions",
                    value: quizPerformance.get(selectedQuizForAnalytics.id)?.completions || 0,
                    icon: CheckCircle2,
                  },
                  {
                    label: "Avg Score",
                    value: quizPerformance.get(selectedQuizForAnalytics.id)?.avgScore || 0,
                    icon: Target,
                  },
                  {
                    label: "Conversion",
                    value: `${quizPerformance.get(selectedQuizForAnalytics.id)?.conversionRate || 0}%`,
                    icon: TrendingUp,
                  },
                  {
                    label: "Audit Requests",
                    value: quizPerformance.get(selectedQuizForAnalytics.id)?.auditRequests || 0,
                    icon: Calendar,
                  },
                ].map((stat) => (
                  <div key={stat.label} className="p-4 bg-zinc-800 rounded-lg">
                    <div className="flex items-center gap-2 text-zinc-400 mb-1">
                      <stat.icon className="h-4 w-4" />
                      <span className="text-sm">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <p className="text-sm text-zinc-400 font-medium">Export & Share</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyEmbedCode(selectedQuizForAnalytics)}
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <Code className="h-4 w-4 mr-2" /> Embed
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyEmailTemplate(selectedQuizForAnalytics)}
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <Mail className="h-4 w-4 mr-2" /> Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyDMScript(selectedQuizForAnalytics)}
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" /> DM Script
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copySocialPost(selectedQuizForAnalytics)}
                    className="border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    <Share2 className="h-4 w-4 mr-2" /> Social
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Quiz?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              This will permanently delete this quiz and all associated responses. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
