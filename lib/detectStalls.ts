import { createClient } from "@/lib/supabase/server"

// Stall detection identifies funnel points where the user's work has gone
// stale and needs attention. Each stall carries a severity, a human-readable
// message, and a direct CTA to resolve it. The dashboard surfaces up to three
// of these beneath Mission Control.
export type StallType =
  | "no_replies"
  | "replies_unanswered"
  | "call_pending"
  | "proposal_pending"
  | "niche_stalled"

export interface Stall {
  type: StallType
  niche_name?: string
  niche_id?: string
  severity: "warning" | "urgent"
  days_stale: number
  message: string
  action_label: string
  action_href: string
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY)
}

export async function detectStalls(userId: string): Promise<Stall[]> {
  const supabase = await createClient()
  const stalls: Stall[] = []
  const now = new Date()

  // Fire all independent queries in parallel — each stall type is independent
  // so we don't need sequential reads.
  const fiveDaysAgo = new Date(now.getTime() - 5 * MS_PER_DAY)
  const threeDaysAgo = new Date(now.getTime() - 3 * MS_PER_DAY)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * MS_PER_DAY)

  const [
    { data: stalledOutreach },
    { data: pendingReplies },
    { data: orphanCalls },
    { data: stalledProposals },
  ] = await Promise.all([
    supabase
      .from("outreach_messages")
      .select("offer_id, sent_at, offers(niche)")
      .eq("user_id", userId)
      .eq("status", "sent")
      .lt("sent_at", fiveDaysAgo.toISOString())
      .order("sent_at", { ascending: true }),
    supabase
      .from("reply_threads")
      .select("id, created_at, outreach_messages(offers(niche))")
      .eq("user_id", userId)
      .eq("response_sent", false)
      .lt("created_at", threeDaysAgo.toISOString()),
    supabase
      .from("call_scripts")
      .select("id, call_completed_at, offer_id, offers(niche)")
      .eq("user_id", userId)
      .eq("call_completed", true)
      .lt("call_completed_at", threeDaysAgo.toISOString()),
    supabase
      .from("proposals")
      .select("id, sent_at, prospect_name, prospect_business")
      .eq("user_id", userId)
      .eq("sent", true)
      .eq("deal_status", "pending")
      .lt("sent_at", fourteenDaysAgo.toISOString()),
  ])

  // 1. Outreach sent 5+ days ago with no replies — grouped by niche so we
  // don't emit one stall per message.
  if (stalledOutreach && stalledOutreach.length > 0) {
    const nicheGroups = new Map<string, typeof stalledOutreach>()
    for (const msg of stalledOutreach) {
      const niche = (msg.offers as any)?.niche as string | undefined
      if (!niche) continue
      const bucket = nicheGroups.get(niche) ?? []
      bucket.push(msg)
      nicheGroups.set(niche, bucket)
    }

    for (const [niche, messages] of nicheGroups) {
      const oldest = messages[0]
      if (!oldest?.sent_at) continue
      const daysStale = daysBetween(now, new Date(oldest.sent_at))
      stalls.push({
        type: "no_replies",
        niche_name: niche,
        severity: daysStale > 10 ? "urgent" : "warning",
        days_stale: daysStale,
        message: `${messages.length} message${messages.length === 1 ? "" : "s"} sent to ${niche} ${daysStale} days ago — no replies yet`,
        action_label: "Generate next batch",
        action_href: `/outreach?niche=${encodeURIComponent(niche)}`,
      })
    }
  }

  // 2. Replies waiting 3+ days for a response.
  if (pendingReplies) {
    for (const reply of pendingReplies) {
      if (!reply.created_at) continue
      const niche = (reply.outreach_messages as any)?.offers?.niche as string | undefined
      const daysStale = daysBetween(now, new Date(reply.created_at))
      stalls.push({
        type: "replies_unanswered",
        niche_name: niche,
        severity: daysStale > 7 ? "urgent" : "warning",
        days_stale: daysStale,
        message: `Reply from ${niche ?? "prospect"} waiting ${daysStale} days for your response`,
        action_label: "Respond now",
        action_href: "/replies",
      })
    }
  }

  // 3. Completed calls without a follow-up proposal — requires a second pass
  // to check if a proposal exists for that offer after the call date.
  if (orphanCalls && orphanCalls.length > 0) {
    const proposalChecks = await Promise.all(
      orphanCalls.map(async (call) => {
        if (!call.offer_id || !call.call_completed_at) return null
        const { data: proposals } = await supabase
          .from("proposals")
          .select("id")
          .eq("user_id", userId)
          .eq("offer_id", call.offer_id)
          .gt("created_at", call.call_completed_at)
          .limit(1)
        return { call, hasProposal: (proposals?.length ?? 0) > 0 }
      }),
    )

    for (const check of proposalChecks) {
      if (!check || check.hasProposal) continue
      const { call } = check
      if (!call.call_completed_at) continue
      const daysStale = daysBetween(now, new Date(call.call_completed_at))
      stalls.push({
        type: "call_pending",
        niche_name: (call.offers as any)?.niche as string | undefined,
        severity: daysStale > 7 ? "urgent" : "warning",
        days_stale: daysStale,
        message: `Call completed ${daysStale} days ago — no proposal sent yet`,
        action_label: "Build proposal",
        action_href: "/proposal/builder?mode=new",
      })
    }
  }

  // 4. Proposals sent 14+ days ago still pending — outcome never marked.
  if (stalledProposals) {
    for (const proposal of stalledProposals) {
      if (!proposal.sent_at) continue
      const daysStale = daysBetween(now, new Date(proposal.sent_at))
      const label = proposal.prospect_business || proposal.prospect_name || "prospect"
      stalls.push({
        type: "proposal_pending",
        severity: daysStale > 21 ? "urgent" : "warning",
        days_stale: daysStale,
        message: `Proposal to ${label} sent ${daysStale} days ago — no outcome marked`,
        action_label: "Mark outcome",
        action_href: `/proposal/builder?id=${proposal.id}`,
      })
    }
  }

  // Sort most severe + oldest first so the dashboard's top-3 slice is the
  // most important triage.
  stalls.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "urgent" ? -1 : 1
    return b.days_stale - a.days_stale
  })

  return stalls
}
