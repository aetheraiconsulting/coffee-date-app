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
  MessageCircle,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AccessGate } from "@/components/access-gate"

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
  const [userContext, setUserContext] = useState("")
  const [generating, setGenerating] = useState(false)
  const [generatingNextBatch, setGeneratingNextBatch] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Independent message state for each channel
  const [linkedinMessages, setLinkedinMessages] = useState<OutreachMessage[]>([])
  const [instagramMessages, setInstagramMessages] = useState<OutreachMessage[]>([])
  const [emailMessages, setEmailMessages] = useState<OutreachMessage[]>([])

  // Reply capture modal. Opened when the user clicks "Log reply" on a sent message.
  // The flow is: paste prospect reply → Claude writes a Voss-style response via
  // /api/outreach/reply (which also saves the reply_thread and marks the message
  // as replied) → user edits and copies the response → closes the modal.
  const [replyModalFor, setReplyModalFor] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [suggestedResponse, setSuggestedResponse] = useState("")
  const [generatingResponse, setGeneratingResponse] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()
  const { state, refreshState } = useUserState()
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
  const repliedCount = currentMessages.filter(m => m.status === "replied").length

  // Reload all messages for a single channel straight from the DB. This is the
  // source of truth after any generate / regenerate / next-batch call, because
  // those operations preserve sent/replied/no_reply rows we don't want to lose
  // from the UI state.
  const reloadMessagesForChannel = async (channel: Channel) => {
    if (!activeOffer || !userId) return
    const { data } = await supabase
      .from("outreach_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("offer_id", activeOffer.id)
      .eq("channel", channel)
      .order("created_at", { ascending: true })
    setChannelMessages(channel, data || [])
  }

  const handleGenerate = async () => {
    if (!activeOffer) return
    setGenerating(true)

    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: activeChannel,
          user_context: userContext || undefined,
        }),
      })

      if (response.status === 402) {
        toast({
          title: "Subscription required",
          description: "Your trial has ended. Subscribe to continue generating new content.",
          variant: "destructive",
        })
        router.push("/upgrade")
        return
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate messages")
      }

      // Reload from DB so sent/replied messages (if any) stay alongside the new drafts.
      await reloadMessagesForChannel(activeChannel)

      toast({
        title: "Messages Generated",
        description: `${data.count ?? 20} ${activeChannel} messages ready to send`,
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

  // Safe regenerate: only DRAFT messages are deleted. Sent, replied, and no_reply
  // rows are preserved so the user never loses outreach they've already done.
  const handleRegenerate = async () => {
    if (!activeOffer || !userId) return

    const ok = window.confirm(
      "Regenerate will replace unsent draft messages with 20 new ones. Sent messages will be preserved. Continue?",
    )
    if (!ok) return

    setGenerating(true)

    try {
      await supabase
        .from("outreach_messages")
        .delete()
        .eq("user_id", userId)
        .eq("offer_id", activeOffer.id)
        .eq("channel", activeChannel)
        .eq("status", "draft")

      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: activeChannel,
          user_context: userContext || undefined,
        }),
      })

      if (response.status === 402) {
        toast({
          title: "Subscription required",
          description: "Your trial has ended. Subscribe to continue generating new content.",
          variant: "destructive",
        })
        router.push("/upgrade")
        return
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to generate messages")

      await reloadMessagesForChannel(activeChannel)

      toast({
        title: "Drafts regenerated",
        description: `${data.count ?? 20} fresh drafts ready. Sent messages preserved.`,
      })
    } catch (error: any) {
      toast({
        title: "Regeneration failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  // Next batch: asks Claude to write 20 more messages using replied messages
  // as positive examples and no_reply messages as negative examples.
  const handleNextBatch = async () => {
    if (!activeOffer) return
    setGeneratingNextBatch(true)
    try {
      const response = await fetch("/api/outreach/next-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: activeChannel }),
      })
      if (response.status === 402) {
        toast({
          title: "Subscription required",
          description: "Your trial has ended. Subscribe to continue generating new content.",
          variant: "destructive",
        })
        router.push("/upgrade")
        return
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to generate next batch")

      await reloadMessagesForChannel(activeChannel)

      toast({
        title: `${data.count ?? 20} new messages generated`,
        description: data.learning_applied
          ? "Based on what's been working in your replies"
          : "Using fresh angles and hooks",
      })
    } catch (error: any) {
      toast({
        title: "Next batch failed",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGeneratingNextBatch(false)
    }
  }

  // Reply modal: close + reset state so the next "Log reply" click starts fresh.
  const closeReplyModal = () => {
    setReplyModalFor(null)
    setReplyText("")
    setSuggestedResponse("")
    setCopiedResponse(false)
  }

  // Call /api/outreach/reply. The API saves the reply_thread, generates a
  // Voss-style response, and flips the outreach_message status to "replied".
  // We then reload the channel so the "Log reply" button becomes "Reply logged".
  const handleGenerateResponse = async () => {
    if (!replyText.trim() || !replyModalFor) return
    setGeneratingResponse(true)
    try {
      const response = await fetch("/api/outreach/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreach_message_id: replyModalFor,
          prospect_reply: replyText,
        }),
      })
      if (response.status === 402) {
        toast({
          title: "Subscription required",
          description: "Your trial has ended. Subscribe to continue generating new content.",
          variant: "destructive",
        })
        router.push("/upgrade")
        return
      }

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to generate response")
      setSuggestedResponse(data.suggested_response || "")
      // Reload so the sent message flips to "replied" in the list behind the modal.
      await reloadMessagesForChannel(activeChannel)
    } catch (error: any) {
      toast({
        title: "Couldn't generate response",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setGeneratingResponse(false)
    }
  }

  // Finalise the logged reply. By this point the API has already saved the
  // thread and updated the message status — this handler just confirms + closes.
  const handleSaveReply = async () => {
    closeReplyModal()
    toast({
      title: "Reply logged",
      description: "You can find it in the Replies section.",
    })
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

  // Feature gate — limited users view existing outreach via /outreach/my-outreach
  // but can't generate new drafts, regenerate, or request next batches here.
  if (state?.accessLevel === "limited") {
    return (
      <div className="bg-black min-h-screen p-8">
        <div className="max-w-3xl mx-auto">
          <AccessGate
            feature="Outreach Generator"
            description="Subscribe to generate new outreach messages. Your existing messages are still accessible in My Outreach."
          />
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

        {/* Claude Cowork Autopilot teaser — narrow strip above the channel tabs.
            Signals to the user that automated sending is on the roadmap so they
            don't feel the copy-paste workflow is forever. */}
        <div className="border border-[#00AAFF]/15 bg-[#00AAFF]/5 rounded-lg px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[#00AAFF] text-xs font-bold tracking-wider">AUTOPILOT COMING SOON</span>
            <span className="text-white/50 text-sm ml-3">
              Q2 2026 — Claude Cowork integration will send your outreach automatically across LinkedIn, Instagram, and email.
            </span>
          </div>
          <span className="flex-shrink-0 text-xs text-white/30">Manual copy-paste for now</span>
        </div>

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
          // Generate view for this channel — no user prompt required. Claude
          // writes 20 messages from the active offer alone; optional context
          // is only a steering hint.
          <div className="border border-white/10 rounded-xl p-6 space-y-5">
            <div>
              <p className="text-white font-semibold text-lg">
                Generate 20 {activeChannel} messages for {activeOffer?.niche}
              </p>
              <p className="text-white/50 text-sm mt-1">
                Claude will write 20 unique messages using 3C Storytelling,
                Chris Voss tactical empathy, and SPIN methodology. Each message
                invites the prospect to a 10-minute demo call.
              </p>
              <p className="text-white/40 text-xs mt-2">{channelDescriptions[activeChannel]}</p>
            </div>

            {/* Optional context */}
            <div className="space-y-2">
              <Label className="text-white/50 text-xs uppercase tracking-wider">
                Optional — Add context
              </Label>
              <Textarea
                placeholder="e.g. Focus on dental practices that advertise on Google Maps..."
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <p className="text-white/30 text-xs">
                Leave blank for default generation based on your offer
              </p>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white py-6 text-base font-bold"
            >
              {generating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Writing 20 messages...
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
                  disabled={generating}
                  title="Sent messages are preserved. Only unsent drafts will be replaced."
                  className="text-white/50 hover:text-white hover:bg-white/10"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Regenerate drafts
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
                          message.status === "draft" && "bg-white/10 text-white/50",
                          message.status === "sent" && "bg-[#00AAFF]/10 text-[#00AAFF]",
                          message.status === "replied" && "bg-green-500/15 text-green-400",
                          message.status === "no_reply" && "bg-white/10 text-white/50",
                        )}
                      >
                        {message.status === "draft" && "Draft"}
                        {message.status === "sent" && "Sent"}
                        {message.status === "replied" && "Replied"}
                        {message.status === "no_reply" && "No reply"}
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
                        {message.status === "sent" && (
                          <button
                            onClick={() => setReplyModalFor(message.id)}
                            className="bg-[#00AAFF]/15 text-[#00AAFF] hover:bg-[#00AAFF]/25 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Log reply
                          </button>
                        )}
                        {message.status === "replied" && (
                          <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Reply logged
                          </span>
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

            {/* Next batch — appears once any messages exist for this channel.
                If any drafts have been marked replied, the API uses those as
                positive examples to steer the next 20. */}
            <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/5 rounded-xl p-5 mt-6 space-y-3">
              <div>
                <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider">
                  Next batch
                </p>
                <p className="text-white font-semibold mt-1">Ready to scale your outreach?</p>
                <p className="text-white/50 text-sm mt-1">
                  Generate 20 more messages. If any of your current batch got replies,
                  Claude will learn from those winners and create the next batch in the same style.
                </p>
              </div>
              <Button
                onClick={handleNextBatch}
                disabled={generatingNextBatch || generating}
                className="bg-[#00AAFF] hover:bg-[#0099EE] text-white font-bold px-5 py-2.5 text-sm"
              >
                {generatingNextBatch ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating next 20...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate next 20
                  </>
                )}
              </Button>
              {repliedCount > 0 && (
                <p className="text-white/40 text-xs">
                  Claude will learn from {repliedCount} message{repliedCount !== 1 ? "s" : ""} that got replies
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Log Reply modal. Two-step flow: paste reply → Claude generates response,
          then edit / copy the response and mark the reply logged. */}
      {replyModalFor && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="log-reply-title"
        >
          <div className="bg-[#0F1318] border border-white/10 rounded-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-1">
                  Log prospect reply
                </p>
                <p id="log-reply-title" className="text-white font-bold">What did they write back?</p>
              </div>
              <button
                onClick={closeReplyModal}
                className="text-white/30 hover:text-white/60"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step 1 — paste the reply */}
            <div className="mb-5">
              <Label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
                Their reply
              </Label>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Paste what the prospect wrote back to your outreach..."
                rows={5}
                className="w-full bg-white/5 border-white/10 text-white text-sm resize-none placeholder:text-white/30"
                disabled={!!suggestedResponse || generatingResponse}
              />
            </div>

            {!suggestedResponse ? (
              <Button
                onClick={handleGenerateResponse}
                disabled={!replyText.trim() || generatingResponse}
                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white font-bold py-6 disabled:opacity-40"
              >
                {generatingResponse ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating response...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate suggested response
                  </>
                )}
              </Button>
            ) : (
              <>
                {/* Step 2 — edit / copy Claude's suggested response */}
                <div className="mb-5">
                  <Label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
                    Claude&apos;s suggested response &mdash; edit if needed
                  </Label>
                  <Textarea
                    value={suggestedResponse}
                    onChange={(e) => setSuggestedResponse(e.target.value)}
                    rows={6}
                    className="w-full bg-white/5 border-white/10 text-white text-sm resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(suggestedResponse)
                      setCopiedResponse(true)
                      setTimeout(() => setCopiedResponse(false), 2000)
                    }}
                    className="flex-1 bg-white/5 border border-white/10 text-white hover:bg-white/10 font-semibold py-6"
                  >
                    {copiedResponse ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied to clipboard
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy response
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleSaveReply}
                    className="flex-1 bg-[#00AAFF] hover:bg-[#0099EE] text-white font-bold py-6"
                  >
                    Mark reply logged
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <p className="text-white/30 text-xs text-center mt-3">
                  Paste the response into {activeChannel === "email" ? "email" : `${activeChannel.charAt(0).toUpperCase() + activeChannel.slice(1)}`} to send it to the prospect
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
