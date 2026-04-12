"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { useUserState } from "@/context/StateContext"
import { Loader2, RefreshCw, ArrowLeft, Send, MessageSquare } from "lucide-react"
import Link from "next/link"

export default function ReplyPage() {
  const params = useParams()
  const router = useRouter()
  const messageId = params.messageId as string
  const supabase = createClient()
  const { refreshState } = useUserState()

  const [view, setView] = useState<"input" | "response">("input")
  const [prospectReply, setProspectReply] = useState("")
  const [suggestedResponse, setSuggestedResponse] = useState("")
  const [responseGoal, setResponseGoal] = useState("")
  const [threadId, setThreadId] = useState("")
  const [loading, setLoading] = useState(false)
  const [originalMessage, setOriginalMessage] = useState<any>(null)
  const [loadingMessage, setLoadingMessage] = useState(true)

  useEffect(() => {
    loadOriginalMessage()
  }, [messageId])

  const loadOriginalMessage = async () => {
    setLoadingMessage(true)
    const { data } = await supabase
      .from("outreach_messages")
      .select("*")
      .eq("id", messageId)
      .single()
    setOriginalMessage(data)
    setLoadingMessage(false)
  }

  const handleGenerateResponse = async () => {
    if (!prospectReply.trim()) return
    setLoading(true)
    try {
      const response = await fetch("/api/outreach/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreach_message_id: messageId,
          prospect_reply: prospectReply,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      setSuggestedResponse(data.suggested_response)
      setResponseGoal(data.response_goal)
      setThreadId(data.thread_id)
      setView("response")
    } catch (error: any) {
      console.error("Error generating response:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/outreach/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreach_message_id: messageId,
          prospect_reply: prospectReply,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      setSuggestedResponse(data.suggested_response)
      setResponseGoal(data.response_goal)
      setThreadId(data.thread_id)
    } catch (error: any) {
      console.error("Error regenerating response:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkSent = async () => {
    if (!threadId) return
    setLoading(true)
    try {
      await supabase
        .from("reply_threads")
        .update({ 
          response_sent: true, 
          response_sent_at: new Date().toISOString() 
        })
        .eq("id", threadId)
      
      await refreshState()
      router.push("/outreach")
    } catch (error: any) {
      console.error("Error marking as sent:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loadingMessage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#00AAFF] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        {/* Back link */}
        <Link 
          href="/outreach" 
          className="inline-flex items-center text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Outreach
        </Link>

        {/* Original message card */}
        {originalMessage && (
          <Card className="bg-white/[0.03] border-white/10">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-2">
                Your original message
              </p>
              <p className="text-white/70 text-sm leading-relaxed">
                {originalMessage.message_text}
              </p>
            </CardContent>
          </Card>
        )}

        {view === "input" ? (
          /* INPUT VIEW */
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white">
                They replied. Let&apos;s respond.
              </h1>
              <p className="text-white/60 mt-2">
                Paste their reply below. Claude will write your next message.
              </p>
            </div>

            <div className="space-y-3">
              <Label className="text-white/70">Their reply</Label>
              <Textarea
                placeholder="Paste exactly what they said..."
                value={prospectReply}
                onChange={(e) => setProspectReply(e.target.value)}
                className="min-h-[120px] bg-white/5 border-white/10 text-white placeholder:text-white/40 resize-none"
              />
            </div>

            <Button
              onClick={handleGenerateResponse}
              disabled={loading || !prospectReply.trim()}
              className="w-full bg-[#00AAFF] hover:bg-[#0099EE] text-white h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Claude is writing your response...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Write my response
                </>
              )}
            </Button>
          </div>
        ) : (
          /* RESPONSE VIEW */
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Their reply */}
              <Card className="bg-white/[0.03] border-white/10">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-white/40">
                    Their reply
                  </p>
                  <p className="text-white/70 text-sm leading-relaxed">
                    {prospectReply}
                  </p>
                </CardContent>
              </Card>

              {/* Your response */}
              <Card className="bg-white/[0.03] border-[#00AAFF]/30">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wider text-[#00AAFF]">
                    Your response
                  </p>
                  <Textarea
                    value={suggestedResponse}
                    onChange={(e) => setSuggestedResponse(e.target.value)}
                    className="min-h-[100px] bg-transparent border-0 text-white p-0 resize-none focus-visible:ring-0"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Response goal */}
            <p className="text-sm text-white/50 italic text-center">
              {responseGoal}
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleRegenerate}
                disabled={loading}
                variant="ghost"
                className="flex-1 text-white/60 hover:text-white hover:bg-white/10 border border-white/10"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate
              </Button>
              <Button
                onClick={handleMarkSent}
                disabled={loading}
                className="flex-1 bg-[#00AAFF] hover:bg-[#0099EE] text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Mark as sent and continue
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
