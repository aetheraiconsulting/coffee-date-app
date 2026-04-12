"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import {
  Send,
  Sparkles,
  Loader2,
  Check,
  Copy,
  RefreshCw,
  MessageSquare,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

type OutreachMessage = {
  id: string
  contact_name: string | null
  business_name: string | null
  message_body: string
  status: "draft" | "sent" | "replied" | "no_reply"
  created_at: string
}

export default function OutreachPage() {
  const [messages, setMessages] = useState<OutreachMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Form state for generation
  const [contactName, setContactName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [niche, setNiche] = useState("")
  const [batchSize, setBatchSize] = useState(5)

  const { toast } = useToast()
  const supabase = createClient()
  const { refreshState } = useUserState()

  useEffect(() => {
    loadMessages()
  }, [])

  const loadMessages = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("outreach_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setMessages(data || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load messages",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName || undefined,
          business_name: businessName || undefined,
          niche: niche || undefined,
          batch_size: batchSize,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate messages")
      }

      toast({
        title: "Messages Generated",
        description: `${data.count} new messages ready to send`,
      })

      // Reload messages
      await loadMessages()

      // Clear form
      setContactName("")
      setBusinessName("")
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

  const handleMarkSent = async (messageId: string) => {
    setSendingId(messageId)
    try {
      const { error } = await supabase
        .from("outreach_messages")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", messageId)

      if (error) throw error

      // Update local state
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "sent" as const } : m))
      )

      // Increment outreach count
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from("outreach").insert({
          user_id: user.id,
          message_id: messageId,
          status: "sent",
        })
      }

      // Refresh state to update mission
      await refreshState()

      toast({
        title: "Marked as Sent",
        description: "Message recorded in your outreach stats",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSendingId(null)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Message copied to clipboard",
    })
  }

  const handleDelete = async (messageId: string) => {
    try {
      const { error } = await supabase.from("outreach_messages").delete().eq("id", messageId)

      if (error) throw error

      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const draftMessages = messages.filter((m) => m.status === "draft")
  const sentMessages = messages.filter((m) => m.status === "sent")

  

  if (loading) {
    return (
      <div className="p-8 bg-black min-h-screen">
        <div className="animate-pulse space-y-4 max-w-7xl mx-auto">
          <div className="h-8 bg-white/10 rounded w-1/3"></div>
          <div className="h-64 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Outreach Messages</h1>
            <p className="text-white/60 mt-1">
              Generate and send personalized cold outreach messages
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-white">{sentMessages.length}</p>
              <p className="text-xs text-white/50">Messages Sent</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-right">
              <p className="text-2xl font-bold text-[#00AAFF]">{draftMessages.length}</p>
              <p className="text-xs text-white/50">Drafts</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Generation Panel */}
          <Card className="lg:col-span-1 bg-white/[0.03] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#00AAFF]" />
                Generate Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/70">Contact Name (optional)</Label>
                <Input
                  placeholder="e.g., John"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Business Name (optional)</Label>
                <Input
                  placeholder="e.g., Acme Corp"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Niche / Industry</Label>
                <Input
                  placeholder="e.g., Real Estate Agents"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/70">Batch Size</Label>
                <div className="flex gap-2">
                  {[3, 5, 10].map((size) => (
                    <Button
                      key={size}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1 border-white/10",
                        batchSize === size
                          ? "bg-[#00AAFF] text-white border-[#00AAFF]"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      )}
                      onClick={() => setBatchSize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {batchSize} Messages
                  </>
                )}
              </Button>

              <p className="text-xs text-white/40 text-center">
                Messages are personalized using your offer and contact details
              </p>
            </CardContent>
          </Card>

          {/* Message Queue */}
          <Card className="lg:col-span-2 bg-white/[0.03] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#00AAFF]" />
                Message Queue
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMessages}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {draftMessages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/60 mb-2">No draft messages</p>
                  <p className="text-sm text-white/40">
                    Generate some messages to get started
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-3">
                    {draftMessages.map((message) => (
                      <div
                        key={message.id}
                        className="p-4 rounded-lg bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <p className="text-white text-sm leading-relaxed">
                              {message.message_body}
                            </p>
                            {(message.contact_name || message.business_name) && (
                              <div className="flex items-center gap-2 text-xs text-white/40">
                                {message.contact_name && <span>{message.contact_name}</span>}
                                {message.contact_name && message.business_name && <span>·</span>}
                                {message.business_name && <span>{message.business_name}</span>}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopy(message.message_body)}
                              className="h-8 w-8 p-0 text-white/40 hover:text-white hover:bg-white/10"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(message.id)}
                              className="h-8 w-8 p-0 text-white/40 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleMarkSent(message.id)}
                              disabled={sendingId === message.id}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white ml-2"
                            >
                              {sendingId === message.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Sent
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sent Messages Section */}
        {sentMessages.length > 0 && (
          <Card className="bg-white/[0.03] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-emerald-400" />
                Recently Sent ({sentMessages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {sentMessages.slice(0, 10).map((message) => (
                    <div
                      key={message.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20"
                    >
                      <p className="text-sm text-white/70 truncate flex-1 mr-4">
                        {message.message_body}
                      </p>
                      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Quick link to dashboard */}
        <div className="flex justify-center">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-white/50 hover:text-white hover:bg-white/10">
              Back to Dashboard
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
