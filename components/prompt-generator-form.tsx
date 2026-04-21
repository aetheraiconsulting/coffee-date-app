"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Sparkles, Copy, Check, Search, ChevronDown, ArrowLeft, Bot } from "lucide-react"
import { generatePrompt } from "@/app/actions/generate-prompt"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"

interface PromptGeneratorFormProps {
  userId: string
}

interface Niche {
  id: string
  niche_name: string
  industry: {
    name: string
  }
}

export default function PromptGeneratorForm({ userId }: PromptGeneratorFormProps) {
  const router = useRouter()
  const supabase = createClient()
  // When the user lands here from the Opportunities page we deep-link with
  // `?niche=<niche_name>` so the niche is pre-selected and the dropdown is
  // collapsed behind a tidy "Building for niche" pill.
  const searchParams = useSearchParams()
  const prefilledNiche = searchParams.get("niche")
  const [nicheLocked, setNicheLocked] = useState<boolean>(!!prefilledNiche)

  // Agent Library context — when the user clicks "Build this agent" in
  // /agents, or "Build for client" on a matched audit recommendation, we
  // receive these params and feed the agent template into the prefill API.
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

  // Phase state
  const [phase, setPhase] = useState<1 | 2>(1)
  const [prefillLoading, setPrefillLoading] = useState(false)
  const [prefillError, setPrefillError] = useState<string | null>(null)

  // Phase 1 inputs (human required). `prospectName` is the actual name the
  // Android will use when talking to the prospect — we bake this into the
  // generated prompt so there are no runtime placeholders like [Name].
  const [businessName, setBusinessName] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [androidName, setAndroidName] = useState("")
  const [prospectName, setProspectName] = useState("")
  const [calendarLink, setCalendarLink] = useState("")

  // Phase 2 inputs (AI pre-filled, editable)
  const [serviceDescription, setServiceDescription] = useState("")
  const [valueProp, setValueProp] = useState("")
  const [nicheQuestion, setNicheQuestion] = useState("")
  const [regionTone, setRegionTone] = useState("")
  const [industryTraining, setIndustryTraining] = useState("")
  const [openingHours, setOpeningHours] = useState("")
  const [promiseLine, setPromiseLine] = useState("")
  const [additionalContext, setAdditionalContext] = useState("")

  // Niche selection
  const [niches, setNiches] = useState<Niche[]>([])
  const [nicheSearchQuery, setNicheSearchQuery] = useState("")
  const [nichePopoverOpen, setNichePopoverOpen] = useState(false)
  const [nicheId, setNicheId] = useState<string | null>(null)
  const [nicheName, setNicheName] = useState("")
  const [customNiche, setCustomNiche] = useState("")

  useEffect(() => {
    fetchNiches()
  }, [])

  // Load the agent template so we can 1) show a context banner and 2) pass
  // the android_prompt_template through to the prefill API as a Claude seed.
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

  // Pre-fill the Phase 1 fields when audit/agent params are supplied.
  // We only set fields that are currently empty so we never stomp on the
  // user's typed-in values during the same session.
  useEffect(() => {
    if (prefilledBusiness && !businessName) setBusinessName(prefilledBusiness)
    if (prefilledClientName && !prospectName) setProspectName(prefilledClientName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledBusiness, prefilledClientName])

  // Once niches have loaded, try to match the ?niche= param against the list.
  // If there's no match, fall back to the custom "Other" flow with the raw value.
  useEffect(() => {
    if (!prefilledNiche || niches.length === 0 || nicheId) return
    const match = niches.find(
      (n) => n.niche_name.toLowerCase().trim() === prefilledNiche.toLowerCase().trim(),
    )
    if (match) {
      setNicheId(match.id)
      setNicheName(match.niche_name)
    } else {
      setNicheId(null)
      setNicheName("Other")
      setCustomNiche(prefilledNiche)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niches, prefilledNiche])

  const fetchNiches = async () => {
    try {
      const response = await fetch("/api/niches")
      if (response.ok) {
        const data = await response.json()
        setNiches(data)
      }
    } catch (error) {
      console.error("Error fetching niches:", error)
    }
  }

  const handleNicheSelect = (id: string | null, name: string) => {
    setNicheId(id)
    setNicheName(name)
    if (id === null && name === "Other") {
      setCustomNiche("")
    }
    setNichePopoverOpen(false)
  }

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
          // Agent Library context — when building from a template, Claude
          // customises the agent template for this specific business rather
          // than generating a generic Coffee Date Demo prompt.
          agent_slug: agentSlug || undefined,
          agent_name: agentNameParam || undefined,
          android_prompt_template: agentTemplate?.android_prompt_template || undefined,
          audit_id: auditId || undefined,
        })
      })

      if (!response.ok) throw new Error("Research failed")

      const data = await response.json()

      // Pre-fill all phase 2 state variables
      setServiceDescription(data.service_description || "")
      setValueProp(data.value_proposition || "")
      setNicheQuestion(data.niche_question || "")
      setRegionTone(data.region_tone || "")
      setIndustryTraining(data.industry_training || "")
      setOpeningHours(data.opening_hours || "")
      setPromiseLine(data.promise_line || "")
      setAdditionalContext(data.additional_context || "")

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
        androidName,
        prospectName,
        nicheId,
        nicheName,
        customNiche,
        serviceType: nicheId ? nicheName : customNiche || nicheName,
        shortService: serviceDescription,
        nicheQuestion,
        valueProp,
        calendarLink,
        regionTone,
        industryTraining,
        website: websiteUrl,
        openingHours,
        promiseLine,
        additionalContext,
        aiPrefilled: true,
        // Agent Library / Audit attribution — these are saved on the Android
        // row so we can trace which agent template and audit this was built
        // from when reviewing the pipeline later.
        agentId: agentTemplate?.id || null,
        agentSlug: agentSlug || null,
        agentName: agentNameParam || agentTemplate?.name || null,
        auditId: auditId || null,
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
    setServiceDescription("")
    setValueProp("")
    setNicheQuestion("")
    setRegionTone("")
    setIndustryTraining("")
    setOpeningHours("")
    setPromiseLine("")
    setAdditionalContext("")
    setNicheId(null)
    setNicheName("")
    setCustomNiche("")
  }

  // Prospect name is now required alongside the other Phase 1 fields.
  const isPhase1Valid =
    businessName.trim() &&
    websiteUrl.trim() &&
    androidName.trim() &&
    prospectName.trim() &&
    calendarLink.trim()
  const isNicheValid = nicheId !== null || (nicheName === "Other" && customNiche.trim() !== "")

  const filteredNiches = niches.filter(
    (niche) =>
      niche.niche_name.toLowerCase().includes(nicheSearchQuery.toLowerCase()) ||
      niche.industry.name.toLowerCase().includes(nicheSearchQuery.toLowerCase()),
  )

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
    <>
      {/* Agent Library context — shown when the user clicked "Build this
          agent" in /agents or "Build for client" on an audit recommendation.
          Visible across both phases so the operator never loses track of the
          agent they're building and the client it's for. */}
      {(agentTemplate || agentNameParam) && (
        <div className="border border-[#00AAFF]/25 bg-[#00AAFF]/[0.05] rounded-xl px-5 py-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="bg-[#00AAFF]/15 border border-[#00AAFF]/25 rounded-lg p-2 flex-shrink-0">
              <Bot className="h-4 w-4 text-[#00AAFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-1">
                Building agent
              </p>
              <p className="text-white font-bold mb-1">
                {agentTemplate?.name || agentNameParam}
              </p>
              {agentTemplate?.one_liner && (
                <p className="text-white/50 text-sm leading-relaxed">
                  {agentTemplate.one_liner}
                </p>
              )}
              {prefilledBusiness && (
                <p className="text-white/70 text-sm mt-2">
                  For client: <span className="font-semibold">{prefilledBusiness}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contextual banner — shown when the user deep-linked in from the
          Opportunities page with `?niche=<niche>`. Keeps the niche visible
          at the top of the page throughout both phases of the form. */}
      {prefilledNiche && (
        <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/5 rounded-xl px-5 py-4 mb-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-0.5">
              Building for niche
            </p>
            <p className="text-white font-semibold truncate">{prefilledNiche}</p>
          </div>
          <a
            href="/prompt-generator"
            className="text-xs text-white/40 hover:text-white/60 whitespace-nowrap"
          >
            Clear
          </a>
        </div>
      )}

    <Card className="glass glass-border">
      <CardHeader>
        <CardTitle className="text-white">Build Android</CardTitle>
        <CardDescription className="text-white/60">
          {phase === 1 
            ? "Enter your client's details and Claude will research their business"
            : "Review and edit the pre-filled details before generating"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Phase 1 - Human inputs */}
        {phase === 1 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName" className="text-white">
                Client business name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="businessName"
                placeholder='e.g. "BrightSky Roofing"'
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">The business you are building this demo for</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="text-white">
                Client website URL <span className="text-red-400">*</span>
              </Label>
              <Input
                id="websiteUrl"
                placeholder="https://brightskyroofing.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">Claude will visit this site to research the business</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="androidName" className="text-white">
                Android name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="androidName"
                placeholder='e.g. "Grace", "Nova", "Jasper"'
                value={androidName}
                onChange={(e) => setAndroidName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">The AI persona name shown in the demo</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prospectName" className="text-white">
                Prospect name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="prospectName"
                placeholder='e.g. "Sarah", "Mike", "Dr Mitchell"'
                value={prospectName}
                onChange={(e) => setProspectName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">
                The AI will address the prospect by this name during the demo
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calendarLink" className="text-white">
                Your calendar link <span className="text-red-400">*</span>
              </Label>
              <Input
                id="calendarLink"
                placeholder="https://calendly.com/yourname"
                value={calendarLink}
                onChange={(e) => setCalendarLink(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">Where prospects book a follow-up call</p>
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

        {/* Phase 2 - Pre-filled fields */}
        {phase === 2 && (
          <>
            {/* Success banner */}
            <div className="bg-[#00A8FF]/10 border border-[#00A8FF]/30 rounded-lg p-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-[#00A8FF]" />
              <p className="text-white text-sm">
                Claude has researched <span className="font-semibold">{businessName}</span> and pre-filled the form below. Review and edit before generating.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Read-only display of Phase 1 inputs */}
              <div className="space-y-2">
                <Label className="text-white">Business Name</Label>
                <Input
                  value={businessName}
                  disabled
                  className="bg-white/5 border-white/10 text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Android Name</Label>
                <Input
                  value={androidName}
                  disabled
                  className="bg-white/5 border-white/10 text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Website</Label>
                <Input
                  value={websiteUrl}
                  disabled
                  className="bg-white/5 border-white/10 text-white/70"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Calendar Link</Label>
                <Input
                  value={calendarLink}
                  disabled
                  className="bg-white/5 border-white/10 text-white/70"
                />
              </div>

              {/* Niche selection. When the user arrived from the Opportunities
                  page via ?niche=..., we skip the dropdown and show a compact
                  "Building for niche" pill with a Change button. */}
              {nicheLocked && (nicheName || customNiche) ? (
                <div className="md:col-span-2 border border-[#00A8FF]/25 bg-[#00A8FF]/5 rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white/40 text-[11px] uppercase tracking-wider mb-0.5">
                      Building for niche
                    </p>
                    <p className="text-white font-semibold">
                      {nicheName === "Other" ? customNiche : nicheName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNicheLocked(false)}
                    className="text-xs text-white/50 hover:text-white underline underline-offset-2"
                  >
                    Change
                  </button>
                </div>
              ) : (
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">
                  Business Niche <span className="text-red-400">*</span>
                </Label>
                <Popover open={nichePopoverOpen} onOpenChange={setNichePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={nichePopoverOpen}
                      className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
                    >
                      {nicheName || "Select a niche..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[400px] p-0 bg-black/95 border border-white/20 backdrop-blur-sm"
                    align="start"
                  >
                    <div className="p-2 border-b border-white/10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                        <Input
                          placeholder="Search niches..."
                          value={nicheSearchQuery}
                          onChange={(e) => setNicheSearchQuery(e.target.value)}
                          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                        />
                      </div>
                    </div>
                    <ScrollArea className="h-[250px]">
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => handleNicheSelect(null, "Other")}
                          className={`w-full text-left p-3 rounded-lg transition-colors ${
                            nicheName === "Other"
                              ? "bg-[#00A8FF]/20 border border-[#00A8FF]"
                              : "hover:bg-white/10 border border-white/10"
                          }`}
                        >
                          <div className="font-semibold text-white">Other</div>
                          <div className="text-sm text-white/70">Enter a custom niche</div>
                        </button>

                        {filteredNiches.map((niche) => (
                          <button
                            key={niche.id}
                            onClick={() => handleNicheSelect(niche.id, niche.niche_name)}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              nicheId === niche.id
                                ? "bg-[#00A8FF]/20 border border-[#00A8FF]"
                                : "hover:bg-white/10 border border-white/10"
                            }`}
                          >
                            <div className="font-semibold text-white">{niche.niche_name}</div>
                            <div className="text-sm text-white/70">{niche.industry.name}</div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-white/40">
                  Choose the niche closest to your client&apos;s service
                </p>
              </div>
              )}

              {/* Custom niche input only shows when the user picked "Other"
                  and hasn't opted into the locked pill view. */}
              {!nicheLocked && nicheName === "Other" && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="customNiche" className="text-white">
                    Custom Niche <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="customNiche"
                    placeholder="Describe the niche..."
                    value={customNiche}
                    onChange={(e) => setCustomNiche(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                </div>
              )}

              {/* AI pre-filled fields */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="serviceDescription" className="text-white">
                  Service Description
                </Label>
                <Input
                  id="serviceDescription"
                  placeholder='e.g. "We install, repair, and replace residential roofs."'
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">A short summary of what the business does</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valueProp" className="text-white">
                  Value Proposition
                </Label>
                <Input
                  id="valueProp"
                  placeholder='e.g. "Fast turnaround, fair pricing, reliable service."'
                  value={valueProp}
                  onChange={(e) => setValueProp(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">What makes the business different or better?</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nicheQuestion" className="text-white">
                  Niche Question
                </Label>
                <Input
                  id="nicheQuestion"
                  placeholder='e.g. "Are you looking for a quote or comparing options?"'
                  value={nicheQuestion}
                  onChange={(e) => setNicheQuestion(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">A natural conversation opener</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="regionTone" className="text-white">
                  Region / Tone
                </Label>
                <Input
                  id="regionTone"
                  placeholder='e.g. "UK professional", "US casual"'
                  value={regionTone}
                  onChange={(e) => setRegionTone(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">Communication style and region</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industryTraining" className="text-white">
                  Industry Training
                </Label>
                <Input
                  id="industryTraining"
                  placeholder='e.g. "Roofing", "Legal Services"'
                  value={industryTraining}
                  onChange={(e) => setIndustryTraining(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">The industry the Android must understand</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openingHours" className="text-white">
                  Opening Hours
                </Label>
                <Input
                  id="openingHours"
                  placeholder='e.g. "Mon–Fri 8–5"'
                  value={openingHours}
                  onChange={(e) => setOpeningHours(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">Used when referencing availability</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promiseLine" className="text-white">
                  Promise Line
                </Label>
                <Input
                  id="promiseLine"
                  placeholder='e.g. "Fast, friendly, and reliable service."'
                  value={promiseLine}
                  onChange={(e) => setPromiseLine(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">A trust-building phrase capturing their brand promise</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="additionalContext" className="text-white">
                  Additional Context
                </Label>
                <Input
                  id="additionalContext"
                  placeholder="Any other relevant context about the business..."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">Relevant context about typical customers, common questions, or business specifics</p>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !isNicheValid}
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
    </>
  )
}
