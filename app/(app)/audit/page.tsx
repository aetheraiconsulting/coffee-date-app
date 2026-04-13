"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  FileText,
  Trash2,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  BarChart3,
  Search,
  PlayCircle,
  Eye,
  FileDown,
  Link2,
  UserCheck,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
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
import { AI_AUDIT_QUESTIONS } from "@/lib/audit-questions"

interface Audit {
  id: string
  name: string
  created_at: string
  updated_at: string
  responses: Record<string, string>
  status: string
  industry?: string
  niche_id?: string
  completion_percentage?: number
  completed_at?: string
  share_token?: string
  prospect_submitted_at?: string
  prospect_name?: string
}

interface Niche {
  id: string
  niche_name: string
}

export default function AuditHomePage() {
  const [audits, setAudits] = useState<Audit[]>([])
  const [niches, setNiches] = useState<Niche[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [industryFilter, setIndustryFilter] = useState("all")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [auditsRes, nichesRes] = await Promise.all([
        supabase.from("audits").select("*").order("created_at", { ascending: false }),
        supabase.from("niches").select("id, niche_name").order("niche_name"),
      ])

      if (auditsRes.error) throw auditsRes.error
      if (nichesRes.error) throw nichesRes.error

      // Calculate completion percentage for each audit
      const auditsWithCompletion = (auditsRes.data || []).map((audit) => ({
        ...audit,
        completion_percentage: calculateCompletion(audit.responses || {}),
        status:
          audit.status ||
          (Object.keys(audit.responses || {}).length === AI_AUDIT_QUESTIONS.length ? "completed" : "in_progress"),
      }))

      setAudits(auditsWithCompletion)
      setNiches(nichesRes.data || [])
    } catch (error) {
      console.error("Error loading data:", error)
      toast({ title: "Error", description: "Failed to load audits", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  function calculateCompletion(responses: Record<string, string>) {
    const answeredQuestions = Object.values(responses).filter((v) => v && v.trim()).length
    return Math.round((answeredQuestions / AI_AUDIT_QUESTIONS.length) * 100)
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("audits").delete().eq("id", id)
      if (error) throw error
      setAudits(audits.filter((a) => a.id !== id))
      toast({ title: "Deleted", description: "Audit deleted successfully" })
    } catch (error) {
      console.error("Error deleting audit:", error)
      toast({ title: "Error", description: "Failed to delete audit", variant: "destructive" })
    }
    setDeleteId(null)
  }

  function generateBlankAuditPDF() {
    const content = `
═══════════════════════════════════════════════════════════════
                    AI READINESS AUDIT
                    Aether AI Lab
═══════════════════════════════════════════════════════════════

Business Name: _________________________________________________

Website URL: __________________________________________________

Industry/Niche: _______________________________________________

Date: ${new Date().toLocaleDateString()}

═══════════════════════════════════════════════════════════════

${AI_AUDIT_QUESTIONS.map(
  (q, i) => `
${i + 1}. ${q.question}

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

`,
).join("")}

═══════════════════════════════════════════════════════════════
                    NOTES & OBSERVATIONS
═══════════════════════════════════════════════════════════════

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

═══════════════════════════════════════════════════════════════
                    Powered by Aether AI Lab
═══════════════════════════════════════════════════════════════
`

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "AI-Readiness-Audit-Blank.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({ title: "Downloaded", description: "Blank audit template downloaded" })
  }

  function handleExportPDF(audit: Audit) {
    const answeredQuestions = AI_AUDIT_QUESTIONS.filter((q) => audit.responses[q.id]?.trim())

    const content = `
═══════════════════════════════════════════════════════════════
                    AI READINESS AUDIT REPORT
                    Aether AI Lab
═══════════════════════════════════════════════════════════════

CLIENT: ${audit.name}
DATE: ${new Date(audit.created_at).toLocaleDateString()}
STATUS: ${audit.status === "completed" ? "COMPLETED" : "IN PROGRESS"}
COMPLETION: ${audit.completion_percentage || calculateCompletion(audit.responses)}%

═══════════════════════════════════════════════════════════════
                    AUDIT RESPONSES
═══════════════════════════════════════════════════════════════

${answeredQuestions
  .map(
    (q, i) => `
${i + 1}. ${q.question}

${audit.responses[q.id] || "No response provided"}

───────────────────────────────────────────────────────────────
`,
  )
  .join("")}

═══════════════════════════════════════════════════════════════
                    KEY INSIGHTS
═══════════════════════════════════════════════════════════════

Based on the responses provided, here are the recommended focus areas:

1. Review and prioritize automation opportunities
2. Identify quick wins for immediate implementation
3. Develop a 90-day AI transformation roadmap

═══════════════════════════════════════════════════════════════

Signature: ____________________________________________________

Date: _________________________________________________________

═══════════════════════════════════════════════════════════════
                    Powered by Aether AI Lab
═══════════════════════════════════════════════════════════════
`

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${audit.name.replace(/\s+/g, "-")}-AI-Audit-Report.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({ title: "Exported", description: "Audit report exported successfully" })
  }

  // Filter audits
  const filteredAudits = audits.filter((audit) => {
    const matchesSearch = audit.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || audit.status === statusFilter
    const matchesIndustry = industryFilter === "all" || audit.industry === industryFilter
    return matchesSearch && matchesStatus && matchesIndustry
  })

  // Calculate stats
  const totalAudits = audits.length
  const inProgressCount = audits.filter((a) => a.status === "in_progress").length
  const completedCount = audits.filter((a) => a.status === "completed").length
  const avgCompletion =
    audits.length > 0
      ? Math.round(audits.reduce((sum, a) => sum + (a.completion_percentage || 0), 0) / audits.length)
      : 0

  // Get unique industries
  const industries = [...new Set(audits.map((a) => a.industry).filter(Boolean))]

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white">AI Readiness Audits</h1>
          <p className="text-white/60 mt-2 text-lg">Create and manage client assessments</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={generateBlankAuditPDF}
            className="border-white/20 hover:border-[#3a8bff]/60 hover:bg-[#3a8bff]/10 text-white bg-transparent"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Download Blank PDF
          </Button>
          <Link href="/audit/builder">
            <Button className="bg-[#3a8bff] hover:bg-[#2d6ed4] text-white shadow-lg shadow-[#3a8bff]/30">
              <Plus className="h-4 w-4 mr-2" />
              Create New Audit
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Total Audits</p>
                <p className="text-3xl font-bold text-white mt-1">{totalAudits}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#3a8bff]/10 border border-[#3a8bff]/30">
                <FileText className="h-6 w-6 text-[#3a8bff]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">In Progress</p>
                <p className="text-3xl font-bold text-amber-400 mt-1">{inProgressCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <Clock className="h-6 w-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Completed</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">{completedCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Avg Completion</p>
                <p className="text-3xl font-bold text-[#3a8bff] mt-1">{avgCompletion}%</p>
              </div>
              <div className="p-3 rounded-xl bg-[#3a8bff]/10 border border-[#3a8bff]/30">
                <BarChart3 className="h-6 w-6 text-[#3a8bff]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-black/40 border-white/10 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search audits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-900 border-zinc-700 text-white placeholder:text-white/40"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px] bg-zinc-900 border-zinc-700 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="all" className="text-white hover:bg-zinc-800">
                  All Statuses
                </SelectItem>
                <SelectItem value="in_progress" className="text-white hover:bg-zinc-800">
                  In Progress
                </SelectItem>
                <SelectItem value="completed" className="text-white hover:bg-zinc-800">
                  Completed
                </SelectItem>
              </SelectContent>
            </Select>
            {industries.length > 0 && (
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-full md:w-[180px] bg-zinc-900 border-zinc-700 text-white">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  <SelectItem value="all" className="text-white hover:bg-zinc-800">
                    All Industries
                  </SelectItem>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind!} className="text-white hover:bg-zinc-800">
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3a8bff] mx-auto mb-4" />
          <p className="text-white/60">Loading audits...</p>
        </div>
      ) : filteredAudits.length === 0 ? (
        <Card className="border-white/10 bg-black/40 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-6 rounded-2xl bg-white/5 mb-6 border border-white/10">
              <FileText className="h-14 w-14 text-[#3a8bff]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">No audits yet</h3>
            <p className="text-white/60 mb-8 text-center max-w-md leading-relaxed">
              Create your first AI readiness assessment to help clients understand their AI transformation opportunities
            </p>
            <Link href="/audit/builder">
              <Button size="lg" className="bg-[#3a8bff] hover:bg-[#2d6ed4] shadow-lg shadow-[#3a8bff]/30">
                <Plus className="h-5 w-5 mr-2" />
                Create First Audit
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAudits.map((audit) => {
            const completion = audit.completion_percentage || calculateCompletion(audit.responses)
            const isCompleted = audit.status === "completed" || completion === 100

            return (
              <Card
                key={audit.id}
                className="border-white/10 bg-black/40 backdrop-blur-sm hover:border-[#3a8bff]/40 hover:bg-black/60 hover:shadow-lg hover:shadow-[#3a8bff]/10 transition-all group"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg text-white line-clamp-1 group-hover:text-[#3a8bff] transition-colors">
                        {audit.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={
                            isCompleted
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/50 bg-amber-500/10 text-amber-400"
                          }
                        >
                          {isCompleted ? "Completed" : "In Progress"}
                        </Badge>
                        {audit.share_token && (
                          <Badge variant="outline" className="border-[#00AAFF]/50 bg-[#00AAFF]/10 text-[#00AAFF]">
                            <Link2 className="h-3 w-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                        {audit.prospect_submitted_at && (
                          <Badge variant="outline" className="border-purple-500/50 bg-purple-500/10 text-purple-400">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Client Submitted
                          </Badge>
                        )}
                        {audit.industry && (
                          <Badge variant="outline" className="border-white/20 text-white/60">
                            {audit.industry}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">Progress</span>
                      <span className="text-white font-medium">{completion}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isCompleted ? "bg-emerald-500" : "bg-[#3a8bff]"}`}
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-white/50">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(audit.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {Object.keys(audit.responses).filter((k) => audit.responses[k]?.trim()).length} /{" "}
                      {AI_AUDIT_QUESTIONS.length}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Link href={`/audit/builder?id=${audit.id}`} className="flex-1">
                      <Button
                        variant="outline"
                        className="w-full border-white/20 hover:border-[#3a8bff]/60 hover:bg-[#3a8bff]/10 text-white bg-transparent"
                      >
                        {isCompleted ? (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Review
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Resume
                          </>
                        )}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleExportPDF(audit)}
                      title="Export PDF"
                      className="border-white/20 hover:border-[#3a8bff]/60 hover:bg-[#3a8bff]/10 text-white"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setDeleteId(audit.id)}
                      title="Delete"
                      className="border-white/20 hover:border-red-500/60 hover:bg-red-500/10 text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Audit</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete this audit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
