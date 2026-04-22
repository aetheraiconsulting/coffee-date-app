"use client"

// Phase 4H — Support request tracking page
// -------------------------------------------------------------------------
// Renders the authenticated operator's own support requests so they can
// see what they've submitted, the Aether Team's response (once Adam or
// Anjal has replied), and cancel any request that's still in the
// `submitted` status. RLS on `support_requests` ensures each user can
// only see their own rows — no filtering required here beyond the
// auth.getUser() check.
// -------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { LifeBuoy } from "lucide-react"

interface SupportRequestRow {
  id: string
  user_id: string
  request_type: string
  involvement_level: string
  status: string
  agent_id: string | null
  audit_id: string | null
  client_business_name: string
  client_niche: string | null
  estimated_deal_value: number | null
  user_notes: string | null
  aether_response: string | null
  aether_response_at: string | null
  created_at: string
  updated_at: string | null
  metadata: Record<string, unknown> | null
  agents?: { name: string | null; slug: string | null } | null
  audits?: { name: string | null; industry: string | null } | null
}

// Status configuration — maps the `support_requests.status` enum values
// to colored pill styles. Keep keys in sync with whatever the admin UI
// is permitted to set (currently: submitted, reviewing, scoping,
// active, complete, declined, cancelled).
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  submitted: { label: "Submitted", color: "text-amber-400", bg: "bg-amber-400/15" },
  reviewing: { label: "Reviewing", color: "text-[#00AAFF]", bg: "bg-[#00AAFF]/15" },
  scoping: { label: "Scoping", color: "text-[#00AAFF]", bg: "bg-[#00AAFF]/15" },
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-400/15" },
  complete: { label: "Complete", color: "text-emerald-400", bg: "bg-emerald-400/15" },
  declined: { label: "Declined", color: "text-red-400", bg: "bg-red-400/15" },
  cancelled: { label: "Canceled", color: "text-white/40", bg: "bg-white/5" },
}

const INVOLVEMENT_LABELS: Record<string, string> = {
  guidance: "Guidance (10%)",
  assistance: "Delivery assistance (30%)",
  full_delivery: "Full delivery (50%)",
}

export default function SupportRequestsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [requests, setRequests] = useState<SupportRequestRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadRequests = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login")
      return
    }

    const { data } = await supabase
      .from("support_requests")
      .select("*, agents(name, slug), audits(name, industry)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setRequests((data as SupportRequestRow[]) || [])
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function cancelRequest(id: string) {
    if (!confirm("Cancel this support request? This cannot be undone.")) return
    await supabase
      .from("support_requests")
      .update({ status: "cancelled" })
      .eq("id", id)
    loadRequests()
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="flex items-start gap-3 mb-6">
        <div className="bg-[#00AAFF]/10 border border-[#00AAFF]/20 rounded-lg p-2.5 flex-shrink-0">
          <LifeBuoy className="h-5 w-5 text-[#00AAFF]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Support Requests</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Your requests for Aether Team delivery help. We respond within 24
            hours via email.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="border border-white/10 rounded-xl p-12 text-center">
          <p className="text-white/50 text-sm font-semibold mb-2">
            No support requests yet
          </p>
          <p className="text-white/30 text-xs leading-relaxed max-w-md mx-auto">
            Click &quot;Deploy this agent&quot; on any agent in the Agent Library
            and choose &quot;Get Aether Team help&quot; — or request delivery
            help on any finished audit.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = STATUS_CONFIG[req.status] || STATUS_CONFIG.submitted
            const involvementLabel =
              INVOLVEMENT_LABELS[req.involvement_level] || req.involvement_level
            // Request type row — prefer the joined agent name, fall
            // back to the audit name, then to a humanised request_type.
            const requestTypeLabel =
              req.agents?.name ||
              req.audits?.name ||
              req.request_type.replace(/_/g, " ")

            return (
              <div
                key={req.id}
                className="border border-white/10 rounded-xl p-5 bg-white/[0.02]"
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold">
                      {req.client_business_name}
                    </p>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <span className="text-white/30 text-xs whitespace-nowrap">
                    {new Date(req.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-3 text-xs">
                  <div>
                    <p className="text-white/30 mb-0.5">Request type</p>
                    <p className="text-white/70 capitalize">{requestTypeLabel}</p>
                  </div>
                  <div>
                    <p className="text-white/30 mb-0.5">Involvement</p>
                    <p className="text-white/70">{involvementLabel}</p>
                  </div>
                  {req.estimated_deal_value != null && (
                    <div>
                      <p className="text-white/30 mb-0.5">Deal value</p>
                      <p className="text-white/70">
                        ${req.estimated_deal_value.toLocaleString("en-US")}
                      </p>
                    </div>
                  )}
                  {req.client_niche && (
                    <div>
                      <p className="text-white/30 mb-0.5">Niche</p>
                      <p className="text-white/70">{req.client_niche}</p>
                    </div>
                  )}
                </div>

                {req.user_notes && (
                  <div className="bg-white/[0.03] border-l-2 border-white/10 pl-3 py-2 mb-3 rounded-r">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-1 font-semibold">
                      Your message
                    </p>
                    <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">
                      {req.user_notes}
                    </p>
                  </div>
                )}

                {req.aether_response && (
                  <div className="bg-[#00AAFF]/5 border-l-2 border-[#00AAFF]/40 pl-3 py-2 rounded-r">
                    <p className="text-[#00AAFF] text-xs uppercase tracking-wider mb-1 font-semibold">
                      Aether Team response
                    </p>
                    <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                      {req.aether_response}
                    </p>
                    {req.aether_response_at && (
                      <p className="text-white/30 text-xs mt-1.5">
                        {new Date(req.aether_response_at).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </p>
                    )}
                  </div>
                )}

                {req.status === "submitted" && (
                  <button
                    onClick={() => cancelRequest(req.id)}
                    className="mt-3 text-white/40 text-xs hover:text-white/70 transition-colors"
                  >
                    Cancel request
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
