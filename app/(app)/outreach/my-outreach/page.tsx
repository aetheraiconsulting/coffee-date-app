"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Send, Mail, MessageSquare, Calendar } from "lucide-react"
import Link from "next/link"

type OutreachMessage = {
  id: string
  message_text: string
  subject_line: string | null
  status: string
  channel: string
  created_at: string
  sent_at: string | null
  offers: {
    niche: string
    service_name: string
  } | null
}

type GroupedOutreach = {
  [niche: string]: {
    serviceName: string
    messages: OutreachMessage[]
    linkedin: { draft: number; sent: number }
    instagram: { draft: number; sent: number }
    email: { draft: number; sent: number }
    lastActivity: string
  }
}

export default function MyOutreachPage() {
  const [loading, setLoading] = useState(true)
  const [groupedOutreach, setGroupedOutreach] = useState<GroupedOutreach>({})
  const supabase = createClient()

  useEffect(() => {
    async function fetchOutreach() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: messages } = await supabase
        .from("outreach_messages")
        .select("*, offers(niche, service_name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!messages) {
        setLoading(false)
        return
      }

      // Group by niche
      const grouped: GroupedOutreach = {}
      messages.forEach((msg: OutreachMessage) => {
        const niche = msg.offers?.niche || "Unknown niche"
        if (!grouped[niche]) {
          grouped[niche] = {
            serviceName: msg.offers?.service_name || "",
            messages: [],
            linkedin: { draft: 0, sent: 0 },
            instagram: { draft: 0, sent: 0 },
            email: { draft: 0, sent: 0 },
            lastActivity: msg.created_at
          }
        }
        grouped[niche].messages.push(msg)
        
        const channel = msg.channel as "linkedin" | "instagram" | "email"
        if (channel && grouped[niche][channel]) {
          if (msg.status === "sent") {
            grouped[niche][channel].sent++
          } else {
            grouped[niche][channel].draft++
          }
        }

        // Update last activity
        const msgDate = msg.sent_at || msg.created_at
        if (msgDate > grouped[niche].lastActivity) {
          grouped[niche].lastActivity = msgDate
        }
      })

      setGroupedOutreach(grouped)
      setLoading(false)
    }

    fetchOutreach()
  }, [supabase])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    })
  }

  const niches = Object.keys(groupedOutreach)

  return (
    <div className="min-h-screen bg-[#080B0F] p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Outreach</h1>
            <p className="text-white/50 text-sm mt-1">
              All your outreach batches grouped by niche
            </p>
          </div>
          <Button asChild className="bg-[#00AAFF] hover:bg-[#0099EE] text-white">
            <Link href="/outreach">
              <Send className="h-4 w-4 mr-2" />
              Generate new messages
            </Link>
          </Button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#00AAFF]" />
          </div>
        )}

        {/* Empty State */}
        {!loading && niches.length === 0 && (
          <Card className="bg-white/[0.02] border-white/10">
            <CardContent className="p-12 text-center">
              <Send className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No outreach generated yet
              </h3>
              <p className="text-white/50 text-sm mb-6">
                Go to Opportunities to select a niche and start generating outreach messages.
              </p>
              <Button asChild className="bg-[#00AAFF] hover:bg-[#0099EE] text-white">
                <Link href="/revival/opportunities">
                  Go to Opportunities
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Niche Cards */}
        {!loading && niches.length > 0 && (
          <div className="space-y-4">
            {niches.map((niche) => {
              const data = groupedOutreach[niche]
              return (
                <Card key={niche} className="bg-white/[0.02] border-white/10 hover:border-white/20 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Niche Name */}
                        <h3 className="text-lg font-bold text-white truncate mb-1">
                          {niche}
                        </h3>
                        {/* Service Name */}
                        <p className="text-sm text-white/50 mb-4">
                          {data.serviceName}
                        </p>
                        
                        {/* Channel Summary */}
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-400" />
                            <span className="text-sm text-white">LinkedIn</span>
                            <span className="text-xs text-white/40">
                              {data.linkedin.sent} sent / {data.linkedin.draft} draft
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-pink-400" />
                            <span className="text-sm text-white">Instagram</span>
                            <span className="text-xs text-white/40">
                              {data.instagram.sent} sent / {data.instagram.draft} draft
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-white">Email</span>
                            <span className="text-xs text-white/40">
                              {data.email.sent} sent / {data.email.draft} draft
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Button
                          asChild
                          size="sm"
                          className="bg-[#00AAFF] hover:bg-[#0099EE] text-white"
                        >
                          <Link href={`/outreach?niche=${encodeURIComponent(niche)}`}>
                            View messages
                          </Link>
                        </Button>
                        <div className="flex items-center gap-1 text-xs text-white/30">
                          <Calendar className="h-3 w-3" />
                          {formatDate(data.lastActivity)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
