"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useParams } from "next/navigation"
import { AndroidPromptCard } from "@/components/android-prompt-card"

type Campaign = {
  id: string
  name: string
  status: string | null
  total_conversations?: number
  total_messages?: number
  response_rate?: number
  synced_at: string
}

type Conversation = {
  id: string
  ghl_conversation_id: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: string | null
  last_message_body: string | null
  last_message_at: string | null
  messages?: any[]
}

export default function AccountDetailPage() {
  const params = useParams()
  const accountId = params.id as string

  const [account, setAccount] = useState<any>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (accountId) {
      loadData()
    }
  }, [accountId])

  const loadData = async () => {
    try {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) setUserId(user.id)

      // Load account details
      const { data: accountData, error: accError } = await supabase
        .from("ghl_connections")
        .select("*")
        .eq("id", accountId)
        .single()

      if (accError) throw accError
      setAccount(accountData)

      // Load campaigns for this account
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("revival_campaigns")
        .select("*")
        .eq("ghl_connection_id", accountId)
        .order("created_at", { ascending: false })

      if (campaignsError) throw campaignsError
      setCampaigns(campaignsData || [])

      // Load conversations for this account
      const { data: conversationsData, error: convsError } = await supabase
        .from("revival_conversations")
        .select("*")
        .eq("ghl_connection_id", accountId)
        .order("last_message_at", { ascending: false })

      if (convsError) throw convsError
      setConversations(conversationsData || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch("/api/revival/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: accountId }),
      })

      if (!response.ok) {
        const error = await response.json()
        let errorMessage = error.message || "Sync failed"

        if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
          errorMessage =
            "Authentication failed. Please check your Private Integration token has the correct scopes."
        } else if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
          errorMessage =
            "Access denied. Ensure your Private Integration has been granted all required permissions."
        } else if (errorMessage.includes("404")) {
          errorMessage = "Location not found. Please verify the Location ID is correct."
        }

        throw new Error(errorMessage)
      }

      const result = await response.json()

      toast({
        title: "Sync Complete",
        description: `Synced ${result.campaignsCount} campaigns and ${result.conversationsCount} conversations`,
      })

      await loadData()
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
        duration: 10000,
      })
    } finally {
      setSyncing(false)
    }
  }

  // Calculate hot leads from conversations with booking intent
  const hotLeads =
    conversations?.filter(
      (c) =>
        c.status === "open" &&
        (c.last_message_body?.toLowerCase().includes("book") ||
          c.last_message_body?.toLowerCase().includes("call") ||
          c.last_message_body?.toLowerCase().includes("appointment") ||
          c.last_message_body?.toLowerCase().includes("schedule") ||
          c.last_message_body?.toLowerCase().includes("yes") ||
          c.last_message_body?.toLowerCase().includes("interested"))
    ).length || 0

  // Calculate response rate from campaigns
  const avgResponseRate =
    campaigns.length > 0
      ? campaigns.reduce((sum, c) => sum + (c.response_rate || 0), 0) / campaigns.length
      : 0

  if (loading || !account) {
    return (
      <div className="p-8 bg-black min-h-screen">
        <div className="animate-pulse space-y-4 max-w-7xl mx-auto">
          <div className="h-8 bg-white/10 rounded w-1/3"></div>
          <div className="h-32 bg-white/10 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.push("/revival")}
          className="text-white hover:text-[#00A8FF] hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Accounts
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-bold text-white">{account.account_name}</h1>
            <p className="text-white/60 text-[15px]">Location ID: {account.location_id}</p>
          </div>
        </div>

        {/* Three key metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Response Rate */}
          <div className="border border-white/10 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-white mb-1">
              {avgResponseRate > 0 ? `${Math.round(avgResponseRate)}%` : "—"}
            </p>
            <p className="text-white/40 text-sm">Response rate</p>
            <p className="text-white/25 text-xs mt-1">Leads who replied</p>
          </div>

          {/* Conversations */}
          <div className="border border-white/10 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-white mb-1">{conversations?.length || 0}</p>
            <p className="text-white/40 text-sm">Conversations</p>
            <p className="text-white/25 text-xs mt-1">Active threads</p>
          </div>

          {/* Hot Leads */}
          <div className="border border-[#00AAFF]/20 bg-[#00AAFF]/5 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-[#00AAFF] mb-1">{hotLeads}</p>
            <p className="text-white/40 text-sm">Hot leads</p>
            <p className="text-white/25 text-xs mt-1">Requested call or booked</p>
          </div>
        </div>

        {/* Android prompt for this niche */}
        {account?.niche_id && userId && <AndroidPromptCard userId={userId} nicheId={account.niche_id} />}

        {/* Conversations list */}
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
            <p className="text-white font-semibold text-sm">Conversations</p>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync now"}
            </button>
          </div>

          {conversations?.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-white/30 text-sm">No conversations yet</p>
              <p className="text-white/20 text-xs mt-1">
                Connect your GHL sub-account and sync to see results
              </p>
            </div>
          ) : (
            conversations?.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] last:border-0"
              >
                <div>
                  <p className="text-white text-sm font-medium">{conv.contact_name || "Unknown"}</p>
                  <p className="text-white/30 text-xs mt-0.5 truncate max-w-xs">
                    {conv.last_message_body || "No messages yet"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      conv.status === "open"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-white/[0.08] text-white/30"
                    }`}
                  >
                    {conv.status || "unknown"}
                  </span>
                  <p className="text-white/20 text-xs">
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
