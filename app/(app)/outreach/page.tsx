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
  ChevronRight,
  Pencil,
  Download,
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
  note: string | null
  created_at: string
  isDirty?: boolean
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
  const [view, setView] = useState<"loading" | "no_offer" | "ready">("loading")
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null)
  const [activeChannel, setActiveChannel] = useState<Channel>("linkedin")
  const [prospectContext, setProspectContext] = useState("")
  const [generating, setGenerating] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Independent message state for each channel
  const [linkedinMessages, setLinkedinMessages] = useState<OutreachMessage[]>([])
  const [instagramMessages, setInstagramMessages] = useState<OutreachMessage[]>([])
  const [emailMessages, setEmailMessages] = useState<OutreachMessage[]>([])

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

    // First try to get offer via profiles.offer_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("offer_id")
      .eq("id", user.id)
      .maybeSingle()

    let offer = null

    if (profile?.offer_id) {
      const { data: offerById } = await supabase
        .from("offers")
        .select("*")
        .eq("id", profile.offer_id)
        .maybeSingle()
      
      if (offerById) {
        offer = offerById
      }
    }

    // Fallback: get most recent active offer directly
    if (!offer) {
      const { data: activeOffer } = await supabase
        .from("offers")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      
      offer = activeOffer
    }

    if (!offer) {
      setView("no_offer")
      return
    }

    setActiveOffer(offer)

    // Fetch all messages for this offer and split by channel
    const { data: allMessages } = await supabase
      .from("outreach_messages")
      .select("*")
      .eq("user_id", user.id)
      .eq("offer_id", offer.id)
      .order("created_at", { ascending: true })

    setLinkedinMessages(allMessages?.filter(m => m.channel === "linkedin") || [])
    setInstagramMessages(allMessages?.filter(m => m.channel === "instagram") || [])
    setEmailMessages(allMessages?.filter(m => m.channel === "email") || [])

    setView("ready")
  }

  const getChannelMessages = (channel: Channel): OutreachMessage[] => {
    switch (channel) {
      case "linkedin": return linkedinMessages
      case "instagram": return instagramMessages
      case "email": return emailMessages
    }
  }

  const setChannelMessages = (channel: Channel, messages: OutreachMessage[]) => {
    switch (channel) {
      case "linkedin": setLinkedinMessages(messages); break
      case "instagram": setInstagramMessages(messages); break
      case "email": setEmailMessages(messages); break
    }
  }

  const currentMessages = getChannelMessages(activeChannel)
  const sentCount = currentMessages.filter(m => m.status === "sent").length
  const totalCount = currentMessages.length

  const handleGenerate = async () => {
    if (!activeOffer) return
    setGenerating(true)

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: activeChannel,
          prospect_context: prospectContext || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate messages")
      }

      setChannelMessages(activeChannel, data.messages)

      toast({
        title: "Messages Generated",
        description: `20 ${activeChannel} messages ready to send`,
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

    // Delete existing messages for this channel only
    await supabase
      .from("outreach_messages")
      .delete()
      .eq("user_id", userId)
      .eq("offer_id", activeOffer.id)
      .eq("channel", activeChannel)

    setChannelMessages(activeChannel, [])
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

    setChannelMessages(
      activeChannel,
      currentMessages.map(m => (m.id === messageId ? { ...m, status: "sent" as const } : m))
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

    setChannelMessages(
      activeChannel,
      currentMessages.map(m => (m.id === messageId ? { ...m, [field]: value } : m))
    )
  }

  const handleNoteUpdate = async (messageId: string, note: string) => {
    await supabase
      .from("outreach_messages")
      .update({ note })
      .eq("id", messageId)

    setChannelMessages(
      activeChannel,
      currentMessages.map(m => (m.id === messageId ? { ...m, note } : m))
    )
  }

  const downloadTextMessages = (messages: OutreachMessage[], channel: string) => {
    const content = messages
      .map((m, i) => `Message ${i + 1}:\n${m.message_text}`)
      .join("\n\n---\n\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${channel}-messages-${new Date().toISOString().split("T")[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadEmailMessages = (messages: OutreachMessage[]) => {
    const header = "Subject Line,Message Body\n"
    const rows = messages
      .map(m => `"${(m.subject_line || "").replace(/"/g, '""')}","${m.message_text.replace(/"/g, '""')}"`)
      .join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `email-messages-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownload = () => {
    if (activeChannel === "email") {
      downloadEmailMessages(currentMessages)
    } else {
      downloadTextMessages(currentMessages, activeChannel)
    }
  }

  const markOutreachStarted = async () => {
    if (!userId) return

    const allSent = [...linkedinMessages, ...instagramMessages, ...emailMessages]
      .filter(m => m.status === "sent").length

    await supabase
      .from("outreach")
      .upsert({
        user_id: userId,
        started: true,
        first_sent_at: new Date().toISOString(),
        total_sent: allSent,
      }, { onConflict: "user_id" })

    await refreshState()
    router.push("/dashboard")
  }

  const handleSaveAndClose = async () => {
    if (!userId) return
    setSaving(true)

    try {
      // Gather all dirty messages across all channels
      const allMessages = [...linkedinMessages, ...instagramMessages, ...emailMessages]
      const unsavedEdits = allMessages.filter(m => m.isDirty)

      // Save any unsaved message text edits
      if (unsavedEdits.length > 0) {
        await Promise.all(unsavedEdits.map(m =>
          supabase
            .from("outreach_messages")
            .update({ message_text: m.message_text, note: m.note, subject_line: m.subject_line })
            .eq("id", m.id)
        ))
      }

      // Mark outreach as started if any messages sent
      const sentCount = allMessages.filter(m => m.status === "sent").length
      if (sentCount > 0) {
        await supabase
          .from("outreach")
          .upsert({
            user_id: userId,
            started: true,
            first_sent_at: new Date().toISOString(),
            total_sent: sentCount,
          }, { onConflict: "user_id" })
      }

      await refreshState()
    } finally {
      setSaving(false)
      router.push("/revival/opportunities")
    }
  }

  const handleMessageEdit = (messageId: string, field: string, value: string) => {
    setChannelMessages(
      activeChannel,
      currentMessages.map(m =>
        m.id === messageId
          ? { ...m, [field]: value, isDirty: true }
          : m
      )
    )
  }

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

  // Ready state
  return (
    <div className="bg-black min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Outreach Messages</h1>
          <p className="text-white/60 mt-1">Generate and manage messages for each channel</p>
        </div>

        {/* Offer Summary Card */}
        {activeOffer && (
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-white font-bold text-base">{activeOffer.niche}</p>
                  <p className="text-white/40 text-sm">{activeOffer.service_name}</p>
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
        )}

        {/* Channel Tabs */}
        <div className="flex border-b border-white/10">
          {(["linkedin", "instagram", "email"] as Channel[]).map(channel => (
            <button
              key={channel}
              onClick={() => setActiveChannel(channel)}
              className={cn(
                "px-6 py-3 text-sm font-medium capitalize border-b-2 transition-colors",
                activeChannel === channel
                  ? "border-[#00AAFF] text-white"
                  : "border-transparent text-white/40 hover:text-white/60"
              )}
            >
              {channel}
              {getChannelMessages(channel).length > 0 && (
                <span className="ml-2 text-xs bg-[#00AAFF]/20 text-[#00AAFF] px-2 py-0.5 rounded-full">
                  {getChannelMessages(channel).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {currentMessages.length === 0 ? (
          // Generate view for this channel
          <div className="space-y-6">
            <p className="text-white/50 text-sm">{channelDescriptions[activeChannel]}</p>

            {/* Prospect Context */}
            <div className="space-y-2">
              <Label className="text-white/70">Any specific context about your prospects? (optional)</Label>
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
        ) : (
          // Messages view for this channel
          <div className="space-y-4">
            {/* Header with Progress and Actions */}
            <div className="flex items-center justify-between">
              <p className="text-white/60">{sentCount} of {totalCount} sent</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white/50 hover:text-white hover:bg-white/10"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  className="text-white/50 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                {sentCount >= 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markOutreachStarted}
                    className="text-white/50 hover:text-white hover:bg-white/10"
                  >
                    I&apos;m done sending
                  </Button>
                )}
                <Button
                  onClick={handleSaveAndClose}
                  disabled={saving}
                  size="sm"
                  className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save and close"
                  )}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#00AAFF] transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (sentCount / totalCount) * 100 : 0}%` }}
              />
            </div>

            {/* Messages */}
            <div className="space-y-4">
              {currentMessages.map((message) => (
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
                      onChange={(e) => handleMessageEdit(message.id, "message_text", e.target.value)}
                      onBlur={(e) => handleUpdateMessage(message.id, "message_text", e.target.value)}
                      className="bg-white/5 border-white/10 text-white min-h-[100px] resize-none"
                      disabled={message.status === "sent"}
                    />

                    {/* Optional Note */}
                    <Input
                      placeholder="e.g. sent to John at BrightSky Roofing"
                      value={message.note || ""}
                      onBlur={(e) => handleNoteUpdate(message.id, e.target.value)}
                      onChange={(e) => setChannelMessages(
                        activeChannel,
                        currentMessages.map(m => m.id === message.id ? { ...m, note: e.target.value } : m)
                      )}
                      className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/30"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            
          </div>
        )}
      </div>
    </div>
  )
}
