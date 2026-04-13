"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import {
  Sparkles,
  Loader2,
  Check,
  Copy,
  RefreshCw,
  Linkedin,
  Instagram,
  Mail,
  ChevronRight,
  Pencil,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Channel = "linkedin" | "instagram" | "email"

type OutreachMessage = {
  id: string
  message_text: string
  subject_line: string | null
  status: "draft" | "sent" | "replied" | "no_reply"
  channel: Channel
  contact_name: string | null
  business_name: string | null
  created_at: string
}

type ActiveOffer = {
  id: string
  service_name: string
  niche: string | null
  pricing_model: string
  price_point: string
  outcome_statement: string | null
  guarantee: string | null
}

const channelDescriptions: Record<Channel, string> = {
  linkedin: "Professional DMs — 100-150 words, business tone",
  instagram: "Social DMs — 60-80 words, casual and direct",
  email: "Cold email — 150-200 words with subject line",
}

function formatPricingModel(model: string): string {
  const labels: Record<string, string> = {
    "50_profit_share": "50% Profit Share",
    "custom_profit_share": "Custom Profit Share",
    "pay_per_lead": "Pay Per Lead",
    "pay_per_conversation": "Pay Per Conversation",
    "retainer": "Retainer",
  }
  return labels[model] || model
}

export default function OutreachPage() {
  const [view, setView] = useState<"loading" | "no_offer" | "generate" | "messages">("loading")
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null)
  const [messages, setMessages] = useState<OutreachMessage[]>([])
  const [channel, setChannel] = useState<Channel>("linkedin")
  const [prospectContext, setProspectContext] = useState("")
  const [generating, setGenerating] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const { toast } = useToast()
  const supabase = createClient()
  const { refreshState } = useUserState()
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }
    setUserId(user.id)

    // Fetch active offer
    const { data: offer } = await supabase
      .from("offers")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!offer) {
      setView("no_offer")
      return
    }

    setActiveOffer(offer)

    // Check for existing draft messages for this offer
    const { data: existingMessages } = await supabase
      .from("outreach_messages")
      .select("*")
      .eq("user_id", user.id)
      .eq("offer_id", offer.id)
      .eq("status", "draft")
      .order("created_at", { ascending: true })

    if (existingMessages && existingMessages.length > 0) {
      setMessages(existingMessages)
      setView("messages")
    } else {
      setView("generate")
    }
  }

  const handleGenerate = async () => {
    if (!activeOffer) return
    setGenerating(true)

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          prospect_context: prospectContext || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate messages")
      }

      setMessages(data.messages)
      setView("messages")

      toast({
        title: "Messages Generated",
        description: "20 outreach messages ready to send",
      })
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    if (!activeOffer || !userId) return

    // Delete existing drafts
    await supabase
      .from("outreach_messages")
      .delete()
      .eq("user_id", userId)
      .eq("offer_id", activeOffer.id)
      .eq("status", "draft")

    setMessages([])
    setView("generate")
  }

  const handleMarkSent = async (messageId: string) => {
    const { error } = await supabase
      .from("outreach_messages")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", messageId)

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      return
    }

    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, status: "sent" as const } : m))
    )
  }

  const handleCopy = (text: string, subjectLine?: string | null) => {
    const fullText = subjectLine ? `Subject: ${subjectLine}\n\n${text}` : text
    navigator.clipboard.writeText(fullText)
    toast({ title: "Copied", description: "Message copied to clipboard" })
  }

  const handleUpdateMessage = async (messageId: string, field: string, value: string) => {
    await supabase
      .from("outreach_messages")
      .update({ [field]: value })
      .eq("id", messageId)

    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, [field]: value } : m))
    )
  }

  const markOutreachStarted = async () => {
    if (!userId) return

    const sentCount = messages.filter(m => m.status === "sent").length

    await supabase
      .from("outreach")
      .upsert({
        user_id: userId,
        started: true,
        first_sent_at: new Date().toISOString(),
        total_sent: sentCount,
      }, { onConflict: "user_id" })

    await refreshState()
    router.push("/dashboard")
  }

  const sentCount = messages.filter(m => m.status === "sent").length
  const totalCount = messages.length

  // Loading state
  if (view === "loading") {
    return (
      <div className="p-8 bg-black min-h-screen">
        <div className="animate-pulse space-y-4 max-w-4xl mx-auto">
          <div className="h-8 bg-white/10 rounded w-1/3"></div>
          <div className="h-64 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  // No offer state
  if (view === "no_offer") {
    return (
      <div className="bg-black min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-6 space-y-4">
              <p className="text-amber-400 text-lg font-medium">
                You need to build your offer before generating outreach messages.
              </p>
              <p className="text-white/60 text-sm">
                Your offer defines your niche, pricing, and guarantee — all of which shape your outreach messaging.
              </p>
              <Button
                onClick={() => router.push("/offer/builder?mode=new")}
                className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
              >
                Build your offer first
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Generate view
  if (view === "generate" && activeOffer) {
    return (
      <div className="bg-black min-h-screen p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Generate Outreach</h1>
            <p className="text-white/60 mt-1">Create personalized messages for your prospects</p>
          </div>

          {/* Offer Summary Card */}
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">{activeOffer.service_name}</h3>
                  <p className="text-white/50 text-sm">{activeOffer.niche}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#00AAFF]/10 text-[#00AAFF] border border-[#00AAFF]/30">
                      {formatPricingModel(activeOffer.pricing_model)}
                    </span>
                    <span className="text-white/40 text-sm">{activeOffer.price_point}</span>
                  </div>
                </div>
                <Link
                  href="/offer/builder"
                  className="text-xs text-white/40 hover:text-white flex items-center gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  Edit offer
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Channel Selector */}
          <div className="space-y-3">
            <Label className="text-white/70">Channel</Label>
            <div className="grid grid-cols-3 gap-3">
              {(["linkedin", "instagram", "email"] as Channel[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-all",
                    channel === ch
                      ? "bg-[#00AAFF] border-[#00AAFF] text-white"
                      : "bg-white/[0.03] border-white/10 text-white/50 hover:border-white/20"
                  )}
                >
                  {ch === "linkedin" && <Linkedin className="h-4 w-4" />}
                  {ch === "instagram" && <Instagram className="h-4 w-4" />}
                  {ch === "email" && <Mail className="h-4 w-4" />}
                  <span className="capitalize">{ch}</span>
                </button>
              ))}
            </div>
            <p className="text-white/40 text-sm">{channelDescriptions[channel]}</p>
          </div>

          {/* Prospect Context */}
          <div className="space-y-2">
            <Label className="text-white/70">Any specific context about your prospects?</Label>
            <Textarea
              placeholder="e.g. focus on owner-operated businesses, avoid franchises, mention local presence"
              value={prospectContext}
              onChange={(e) => setProspectContext(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[80px]"
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white py-6 text-lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Claude is writing your messages...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate 20 messages
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Messages view
  return (
    <div className="bg-black min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header with Progress */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Your Messages</h1>
            <p className="text-white/60 mt-1">{sentCount} of {totalCount} sent</p>
          </div>
          <Button
            variant="ghost"
            onClick={handleRegenerate}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate messages
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00AAFF] transition-all duration-300"
            style={{ width: `${(sentCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Messages */}
        <div className="space-y-4">
          {messages.map((message) => (
            <Card
              key={message.id}
              className={cn(
                "bg-white/[0.03] border-white/10",
                message.status === "sent" && "border-emerald-500/30 bg-emerald-500/5"
              )}
            >
              <CardContent className="p-4 space-y-3">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      message.status === "draft"
                        ? "bg-white/10 text-white/50"
                        : "bg-[#00AAFF]/10 text-[#00AAFF]"
                    )}
                  >
                    {message.status === "draft" ? "Draft" : "Sent"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(message.message_text, message.subject_line)}
                      className="h-7 px-2 text-xs text-white/40 hover:text-white hover:bg-white/10"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    {message.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkSent(message.id)}
                        className="h-7 px-2 text-xs text-white/40 hover:text-white hover:bg-white/10"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Mark as sent
                      </Button>
                    )}
                  </div>
                </div>

                {/* Subject Line (email only) */}
                {message.channel === "email" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-white/40">Subject Line</Label>
                    <Input
                      value={message.subject_line || ""}
                      onChange={(e) => handleUpdateMessage(message.id, "subject_line", e.target.value)}
                      className="bg-white/5 border-white/10 text-white text-sm"
                      disabled={message.status === "sent"}
                    />
                  </div>
                )}

                {/* Message Text */}
                <Textarea
                  value={message.message_text}
                  onChange={(e) => handleUpdateMessage(message.id, "message_text", e.target.value)}
                  className="bg-white/5 border-white/10 text-white min-h-[100px] resize-none"
                  disabled={message.status === "sent"}
                />

                {/* Contact/Business Name */}
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Contact name"
                    value={message.contact_name || ""}
                    onChange={(e) => handleUpdateMessage(message.id, "contact_name", e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/30"
                    disabled={message.status === "sent"}
                  />
                  <Input
                    placeholder="Business name"
                    value={message.business_name || ""}
                    onChange={(e) => handleUpdateMessage(message.id, "business_name", e.target.value)}
                    className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/30"
                    disabled={message.status === "sent"}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Done Button */}
        {sentCount >= 5 && (
          <Button
            variant="ghost"
            onClick={markOutreachStarted}
            className="w-full text-white/50 hover:text-white hover:bg-white/10 py-6"
          >
            I&apos;m done sending for now
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}
