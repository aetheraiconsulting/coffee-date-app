"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Sparkles, Copy, Check, ArrowLeft } from "lucide-react"
import { generatePrompt } from "@/app/actions/generate-prompt"
import { createClient } from "@/lib/supabase/client"

interface PromptGeneratorFormProps {
  userId: string
}

// Default response messages — used to pre-populate the textareas in Phase 1
// so the operator only has to edit if they want a different voice. The
// negative default is a function of openingServicePhrase: when the operator
// types into Opening Service Phrase, the negative response default updates
// dynamically (until the operator manually edits it themselves).
const POSITIVE_DEFAULT =
  "Thank goodness, my calendar just pinged me to call, but I didn't want to disturb you — are you still looking for help?"
const buildNegativeDefault = (phrase: string) =>
  `Sorry about that — just to confirm, are you still interested in ${phrase || "[openingServicePhrase]"}?`

export default function PromptGeneratorForm({ userId }: PromptGeneratorFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()

  // Agent / audit URL params still flow through to the prefill API so Claude
  // can seed from a template, but the visible banner has been removed per
  // the simplification brief. The fields silently feed the research call.
  const agentSlug = searchParams.get("agent_slug")
  const agentNameParam = searchParams.get("agent_name")
  const prefilledClientName = searchParams.get("client_name")
  const prefilledBusiness = searchParams.get("business")
  const auditId = searchParams.get("audit_id")
  const [agentTemplate, setAgentTemplate] = useState<any>(null)

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null)
  const [generatedAndroidId, setGeneratedAndroidId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Phase state.
  const [phase, setPhase] = useState<1 | 2>(1)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  // Phase 1 — operator-supplied fields. Required unless marked optional.
  const [businessName, setBusinessName] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [androidName, setAndroidName] = useState("")
  const [prospectName, setProspectName] = useState("")
  const [openingServicePhrase, setOpeningServicePhrase] = useState("")
  const [positiveResponse, setPositiveResponse] = useState(POSITIVE_DEFAULT)
  const [negativeResponse, setNegativeResponse] = useState(buildNegativeDefault(""))
  // Tracks whether the operator has manually edited the negative response.
  // Once true, the dynamic update on openingServicePhrase change stops so we
  // don't silently overwrite the operator's wording.
  const [negativeUserEdited, setNegativeUserEdited] = useState(false)
  const [calendarLink, setCalendarLink] = useState("")
  const [faq, setFaq] = useState("")

  // Phase 2 — Claude pre-fills these from the website. The operator can edit
  // them before the final prompt is generated. companySummary, regionTone,
  // industryTraining and the hidden nicheSlug are pre-filled but not shown
  // as editable fields in Phase 2 (only qualifyingQuestion is, per brief).
  const [qualifyingQuestion, setQualifyingQuestion] = useState("")
  const [companySummary, setCompanySummary] = useState("")
  const [regionTone, setRegionTone] = useState("")
  const [industryTraining, setIndustryTraining] = useState("")
  const [nicheSlug, setNicheSlug] = useState("")

  // Negative response default tracks openingServicePhrase until the operator
  // edits the textarea themselves. This implements the brief's requirement
  // that "[openingServicePhrase]" in the default is replaced live.
  useEffect(() => {
    if (!negativeUserEdited) {
      setNegativeResponse(buildNegativeDefault(openingServicePhrase))
    }
  }, [openingServicePhrase, negativeUserEdited])

  // Load the agent template silently so we can pass the prompt template
  // through to the prefill API. No UI is rendered for this — the brief
  // removed the agent library banner.
  useEffect(() => {
    if (!agentSlug) return
    const load = async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, slug, name, one_liner, android_prompt_template")
        .eq("slug", agentSlug)
        .maybeSingle()
      if (data) setAgentTemplate(data)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSlug])

  // Pre-fill businessName / prospectName from URL params when arriving from
  // a "Build for client" link. We only set fields that are currently empty
  // so we never stomp on the user's typed-in values during the same session.
  useEffect(() => {
    if (prefilledBusiness && !businessName) setBusinessName(prefilledBusiness)
    if (prefilledClientName && !prospectName) setProspectName(prefilledClientName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledBusiness, prefilledClientName])

  const handlePrefill = async () => {
    setPrefillLoading(true)
    setPrefillError(null)

    try {
      const response = await fetch("/api/androids/prefill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          website_url: websiteUrl,
          // Agent / audit context — still passed through silently.
          agent_slug: agentSlug || undefined,
          agent_name: agentNameParam || undefined,
          android_prompt_template: agentTemplate?.android_prompt_template || undefined,
          audit_id: auditId || undefined,
        }),
      })

      if (!response.ok) throw new Error("Research failed")

      const data = await response.json()

      // Pre-fill the editable Phase 2 field plus the hidden context fields.
      setQualifyingQuestion(data.qualifying_question || "")
      setCompanySummary(data.company_summary || "")
      setRegionTone(data.region_tone || "")
      setIndustryTraining(data.industry_training || "")
      setNicheSlug(data.niche_slug || "")

      setPhase(2)
    } catch {
      setPrefillError("Unable to research this business. Check the website URL and try again.")
    } finally {
      setPrefillLoading(false)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const dataToSend = {
        businessName,
        websiteUrl,
        androidName,
        prospectName,
        openingServicePhrase,
        positiveResponse,
        negativeResponse,
        calendarLink,
        faq: faq.trim() || undefined,
        qualifyingQuestion,
        // serviceType still drives androids.niche on insert. We prefer the
        // slug but fall back to the human industry label if Claude omitted it.
        serviceType: nicheSlug || industryTraining || undefined,
        companySummary,
        regionTone,
        industryTraining,
      }
      const result = await generatePrompt(dataToSend, userId)
      if (result.success && result.androidId && result.prompt) {
        setGeneratedPrompt(result.prompt)
        setGeneratedAndroidId(result.androidId)
      }
    } catch (error) {
      console.error("Error generating prompt:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (generatedPrompt) {
      navigator.clipboard.writeText(generatedPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleUseInBuilder = () => {
    if (generatedAndroidId) {
      router.push(`/demo/${generatedAndroidId}?type=test`)
    }
  }

  const handleStartOver = () => {
    setPhase(1)
    setQualifyingQuestion("")
    setCompanySummary("")
    setRegionTone("")
    setIndustryTraining("")
    setNicheSlug("")
  }

  const isPhase1Valid =
    businessName.trim() &&
    websiteUrl.trim() &&
    androidName.trim() &&
    prospectName.trim() &&
    openingServicePhrase.trim() &&
    positiveResponse.trim() &&
    negativeResponse.trim() &&
    calendarLink.trim()

  const isPhase2Valid = qualifyingQuestion.trim()

  if (generatedPrompt) {
    return (
      <Card className="glass glass-border">
        <CardHeader>
          <CardTitle className="text-white">Generated Coffee Date Prompt</CardTitle>
          <CardDescription className="text-white-secondary">Your Android is ready to use</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-black/40 p-4 rounded-lg max-h-96 overflow-y-auto border border-white/10">
            <pre className="text-sm whitespace-pre-wrap font-mono text-white">{generatedPrompt}</pre>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex-1 border-aether text-aether hover:bg-aether hover:text-white bg-transparent"
            >
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? "Copied!" : "Copy Prompt"}
            </Button>
            <Button onClick={handleUseInBuilder} className="flex-1 bg-aether text-white hover:aether-glow">
              Use in Android Builder
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass glass-border">
      <CardHeader>
        <CardTitle className="text-white">Build Android</CardTitle>
        <CardDescription className="text-white/60">
          {phase === 1
            ? "Enter your client's details and Claude will research their business"
            : "Review and edit the qualifying question before generating"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phase 1 — operator inputs. */}
        {phase === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-white">
                Business Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="businessName"
                placeholder="e.g. Next Ride Motorcycles"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="text-white">
                Website URL <span className="text-red-400">*</span>
              </Label>
              <Input
                id="websiteUrl"
                placeholder="e.g. https://www.nextride.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="androidName" className="text-white">
                AI Persona Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="androidName"
                placeholder="e.g. Grace"
                value={androidName}
                onChange={(e) => setAndroidName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">The name your AI assistant will use in the conversation</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prospectName" className="text-white">
                Prospect First Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="prospectName"
                placeholder="e.g. Mike"
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">The AI will address the prospect by this name throughout</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openingServicePhrase" className="text-white">
                Opening Service Phrase <span className="text-red-400">*</span>
              </Label>
              <Input
                id="openingServicePhrase"
                placeholder="e.g. getting a motorcycle quote, selling your property for cash"
                value={openingServicePhrase}
                onChange={(e) => setOpeningServicePhrase(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">How the AI describes your service in the opening message</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="positiveResponse" className="text-white">
                Positive Response Message <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="positiveResponse"
                value={positiveResponse}
                onChange={(e) => setPositiveResponse(e.target.value)}
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">
                Sent word for word when the prospect confirms it&apos;s them. Edit if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="negativeResponse" className="text-white">
                Negative Response Message <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="negativeResponse"
                value={negativeResponse}
                onChange={(e) => {
                  setNegativeResponse(e.target.value)
                  setNegativeUserEdited(true)
                }}
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">
                Sent word for word when the prospect says wrong number or not interested. Edit if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendarLink" className="text-white">
                Calendar Link <span className="text-red-400">*</span>
              </Label>
              <Input
                id="calendarLink"
                placeholder="e.g. https://calendly.com/yourbusiness"
                value={calendarLink}
                onChange={(e) => setCalendarLink(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faq" className="text-white">
                FAQ
              </Label>
              <Textarea
                id="faq"
                placeholder="Add any frequently asked questions and answers your AI should know. e.g. Q: What areas do you cover? A: We cover all of Texas."
                value={faq}
                onChange={(e) => setFaq(e.target.value)}
                rows={5}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">Optional — add Q&amp;A your AI should be able to answer</p>
            </div>

            {prefillError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                {prefillError}
              </div>
            )}

            <Button
              onClick={handlePrefill}
              disabled={!isPhase1Valid || prefillLoading}
              className="w-full bg-[#00A8FF] text-white hover:bg-[#0099EE]"
            >
              {prefillLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Claude is researching this business...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Research and pre-fill
                </>
              )}
            </Button>
          </div>
        )}

        {/* Phase 2 — Claude has researched. Only the qualifying question is
            editable here (per the simplification brief). The other research
            fields (company summary, region/tone, industry) are baked into
            the system prompt without operator review. */}
        {phase === 2 && (
          <>
            <div className="bg-[#00A8FF]/10 border border-[#00A8FF]/30 rounded-lg p-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-[#00A8FF]" />
              <p className="text-white text-sm">
                Claude has researched <span className="font-semibold">{businessName}</span>. Review the qualifying
                question below and generate when ready.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualifyingQuestion" className="text-white">
                Qualifying Question <span className="text-red-400">*</span>
              </Label>
              <Textarea
                id="qualifyingQuestion"
                value={qualifyingQuestion}
                onChange={(e) => setQualifyingQuestion(e.target.value)}
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">
                One question to qualify the prospect. Pre-filled from your website — edit if needed.
              </p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !isPhase2Valid}
              className="w-full bg-[#00A8FF] text-white hover:bg-[#0099EE]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating prompt...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Android prompt
                </>
              )}
            </Button>

            <Button
              onClick={handleStartOver}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Start over
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
