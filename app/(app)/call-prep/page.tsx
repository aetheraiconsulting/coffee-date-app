"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Loader2,
  Sparkles,
  Phone,
  CheckCircle2,
  MessageSquare,
  HelpCircle,
  ShieldAlert,
  Target,
  RefreshCw,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"

type CallScript = {
  id: string
  opening: string
  qualification_questions: string
  objection_responses: string
  close_ask: string
  call_completed: boolean
  call_notes: string | null
}

type ChecklistItem = {
  id: string
  label: string
  checked: boolean
}

export default function CallPrepPage() {
  const [script, setScript] = useState<CallScript | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [callNotes, setCallNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: "1", label: "Quiet environment ready", checked: false },
    { id: "2", label: "Water nearby", checked: false },
    { id: "3", label: "Calendar open for booking", checked: false },
    { id: "4", label: "Pricing ready to share", checked: false },
    { id: "5", label: "Offer details reviewed", checked: false },
  ])

  const { toast } = useToast()
  const supabase = createClient()
  const { refreshState } = useUserState()

  useEffect(() => {
    fetchScript()
  }, [])

  const fetchScript = async () => {
    try {
      const res = await fetch("/api/demo/script")
      const data = await res.json()
      if (data.script) {
        setScript(data.script)
        setCallNotes(data.script.call_notes || "")
      }
    } catch (error) {
      console.error("Error fetching script:", error)
    } finally {
      setLoading(false)
    }
  }

  const generateScript = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/demo/script", { method: "POST" })
      const data = await res.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setScript(data.script)
      toast({
        title: "Script generated",
        description: "Your call script is ready. Review it before your call.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const regenerateScript = async () => {
    if (script) {
      await supabase.from("call_scripts").delete().eq("id", script.id)
    }
    setScript(null)
    await generateScript()
  }

  const toggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    )
  }

  const allChecked = checklist.every((item) => item.checked)

  const markCallComplete = async () => {
    if (!script) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from("call_scripts")
        .update({
          call_completed: true,
          call_completed_at: new Date().toISOString(),
          call_notes: callNotes || null,
        })
        .eq("id", script.id)

      if (error) throw error

      setScript({ ...script, call_completed: true, call_notes: callNotes })
      await refreshState()

      toast({
        title: "Call completed",
        description: "Great work! Your progress has been updated.",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!script) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#00AAFF]/10 flex items-center justify-center mx-auto">
              <Phone className="h-8 w-8 text-[#00AAFF]" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Prepare Your Demo Call
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Generate a personalized call script based on your offer. 
              This will help you stay on track and close more deals.
            </p>
            <Button
              onClick={generateScript}
              disabled={generating}
              size="lg"
              className="bg-[#00AAFF] hover:bg-[#00AAFF]/90 text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Script...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate My Script
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Demo Preparation</h1>
            <p className="text-muted-foreground">
              {script.call_completed 
                ? "This call has been completed" 
                : "Review your script and complete the checklist before your call"}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={regenerateScript}
            disabled={generating}
            className="border-border"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Pre-Call Checklist
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center space-x-3 cursor-pointer"
                    onClick={() => toggleChecklist(item.id)}
                  >
                    <Checkbox
                      id={item.id}
                      checked={item.checked}
                      onCheckedChange={() => toggleChecklist(item.id)}
                    />
                    <label
                      htmlFor={item.id}
                      className={`text-sm cursor-pointer ${
                        item.checked ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {item.label}
                    </label>
                  </div>
                ))}

                {allChecked && (
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm text-emerald-500 font-medium">
                      You&apos;re ready for your call!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MessageSquare className="h-5 w-5 text-[#00AAFF]" />
                  Post-Call Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="How did the call go? Any follow-ups needed?"
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="min-h-[120px] bg-background border-border"
                  disabled={script.call_completed}
                />
                {!script.call_completed && (
                  <Button
                    onClick={markCallComplete}
                    disabled={saving}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark Call as Completed
                      </>
                    )}
                  </Button>
                )}
                {script.call_completed && (
                  <Link href="/pipeline">
                    <Button className="w-full bg-[#00AAFF] hover:bg-[#00AAFF]/90 text-white">
                      Continue to Pipeline
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Phone className="h-5 w-5 text-[#00AAFF]" />
                  Opening
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {script.opening}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <HelpCircle className="h-5 w-5 text-amber-500" />
                  Qualification Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[300px]">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {script.qualification_questions}
                  </p>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  Objection Responses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[300px]">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {script.objection_responses}
                  </p>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="bg-card border-border border-2 border-emerald-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Target className="h-5 w-5 text-emerald-500" />
                  The Close
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap text-lg">
                  {script.close_ask}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
