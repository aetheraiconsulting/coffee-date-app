import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

/**
 * Re-engagement cron. Runs daily.
 *
 * Three-stage ladder based on days since last_activity_at:
 *   - Day 7   → stage "day_7"   → gentle nudge
 *   - Day 14  → stage "day_14"  → pipeline-aware reminder
 *   - Day 30  → stage "day_30"  → final "should we close your account?" note
 *
 * We pick the stage based on the CURRENT days-dormant value and send at most
 * one email per stage per user (tracked via profiles.reengagement_stage). The
 * stage is cleared whenever the user does anything real — see /lib/trackActivity.
 *
 * Emails are dispatched via Resend if RESEND_API_KEY is set. When it isn't
 * (local dev, preview without secrets, etc.) the handler just logs what it
 * would have sent and still updates the DB so the ladder advances during tests.
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` or Vercel's own
 * `x-vercel-cron` header (set by the platform for scheduled triggers).
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

type PipelineStage =
  | "no_outreach"
  | "outreach_no_replies"
  | "replies_no_calls"
  | "calls_no_proposals"
  | "proposals_no_wins"
  | "has_wins"

type ReengagementStage = "day_7" | "day_14" | "day_30"

interface DormantProfile {
  id: string
  email: string | null
  full_name: string | null
  last_activity_at: string | null
  reengagement_stage: string | null
  offer_id: string | null
}

function daysBetween(fromIso: string | null, now: Date): number {
  if (!fromIso) return Infinity
  const from = new Date(fromIso)
  const diffMs = now.getTime() - from.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function stageForDays(days: number): ReengagementStage | null {
  if (days >= 30) return "day_30"
  if (days >= 14) return "day_14"
  if (days >= 7) return "day_7"
  return null
}

/** Lightweight pipeline lookup — one count per table, no joins. */
async function getPipelineStage(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<PipelineStage> {
  const [wonRes, proposalsRes, callsRes, repliesRes, outreachRes] = await Promise.all([
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("deal_status", "won"),
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("sent", true),
    supabase.from("call_scripts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("call_completed", true),
    supabase.from("reply_threads").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("outreach_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "sent"),
  ])

  if ((wonRes.count ?? 0) > 0) return "has_wins"
  if ((proposalsRes.count ?? 0) > 0) return "proposals_no_wins"
  if ((callsRes.count ?? 0) > 0) return "calls_no_proposals"
  if ((repliesRes.count ?? 0) > 0) return "replies_no_calls"
  if ((outreachRes.count ?? 0) > 0) return "outreach_no_replies"
  return "no_outreach"
}

interface EmailCopy {
  subject: string
  body: string
  cta_label: string
  cta_href: string
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aetherrevive.com"

/** Pick the right email body for this user's stage + pipeline position. */
function composeEmail(
  stage: ReengagementStage,
  pipeline: PipelineStage,
  firstName: string,
): EmailCopy {
  const generic: EmailCopy = {
    subject:
      stage === "day_30"
        ? "Last check-in from Aether Revive"
        : stage === "day_14"
        ? "Still in? Your sprint is waiting"
        : "Ready for the next step?",
    body:
      stage === "day_30"
        ? `Hi ${firstName},\n\nIt's been a month since you last used Aether Revive. If you've moved on that's completely fine — reply and I'll pause your account.\n\nIf you want to pick up where you left off, your account and work are still here.`
        : stage === "day_14"
        ? `Hi ${firstName},\n\nYou haven't been back in two weeks. The sprint is designed to land a first client in 14 days — every day away is a day someone else gets that client.`
        : `Hi ${firstName},\n\nWe haven't seen you in a week. You're closer than you think — one action today keeps the sprint alive.`,
    cta_label: "Open Aether Revive",
    cta_href: `${appUrl}/dashboard`,
  }

  // Pipeline-aware overrides. Only applied at day_7 and day_14 — by day_30 the
  // tone is deliberately generic because we're closing the loop, not selling.
  if (stage === "day_30") return generic

  switch (pipeline) {
    case "no_outreach":
      return {
        subject: "You haven't sent any outreach yet",
        body: `Hi ${firstName},\n\nYour offer is built but you haven't started outreach. Twenty messages on one channel is the fastest way to get a reply — the system will write them for you in under a minute.`,
        cta_label: "Generate my first 20 messages",
        cta_href: `${appUrl}/outreach`,
      }
    case "outreach_no_replies":
      return {
        subject: "Your messages are out — now what?",
        body: `Hi ${firstName},\n\nYou've sent outreach but nothing has come back yet. That's normal for batch one. The second batch is where most agencies get their first reply — want to generate it?`,
        cta_label: "Generate next batch",
        cta_href: `${appUrl}/outreach`,
      }
    case "replies_no_calls":
      return {
        subject: "A reply is waiting — turn it into a call",
        body: `Hi ${firstName},\n\nYou've got replies sitting in your pipeline but no calls booked. A 10-minute demo is the one question you need to ask them. The app will draft the response for you.`,
        cta_label: "Open replies",
        cta_href: `${appUrl}/outreach`,
      }
    case "calls_no_proposals":
      return {
        subject: "Your call happened — now send the proposal",
        body: `Hi ${firstName},\n\nYou ran a demo call but haven't sent the proposal. The longer you wait the colder it gets. The proposal writes itself from your call notes — 2 minutes.`,
        cta_label: "Write proposal",
        cta_href: `${appUrl}/proposal/builder?mode=new`,
      }
    case "proposals_no_wins":
      return {
        subject: "Follow up your open proposal",
        body: `Hi ${firstName},\n\nYou've got a live proposal and no close yet. A single follow-up today can flip it. Want to send one?`,
        cta_label: "Open proposals",
        cta_href: `${appUrl}/proposal/builder`,
      }
    case "has_wins":
      return {
        subject: "Your client is active — is the next one lined up?",
        body: `Hi ${firstName},\n\nYou've won. Amazing. The second client is easier — same offer, slightly tighter outreach. Pick a new niche and start the next sprint in one click.`,
        cta_label: "Start next sprint",
        cta_href: `${appUrl}/revival/opportunities`,
      }
  }
}

async function sendEmail(to: string, copy: EmailCopy): Promise<"sent" | "logged"> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.REENGAGEMENT_FROM_EMAIL || "Aether Revive <hello@aetherrevive.com>"

  if (!apiKey) {
    console.log("[reengagement] RESEND_API_KEY not set — would send", { to, subject: copy.subject })
    return "logged"
  }

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
    <h1 style="font-size:20px;margin:0 0 16px">${copy.subject}</h1>
    <div style="white-space:pre-line;line-height:1.55;font-size:15px;color:#333">${copy.body}</div>
    <p style="margin-top:24px"><a href="${copy.cta_href}" style="background:#00AAFF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${copy.cta_label}</a></p>
    <p style="font-size:12px;color:#888;margin-top:32px">Reply to this email if you'd like us to pause your account.</p>
  </body></html>`

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: copy.subject,
      html,
      text: `${copy.body}\n\n${copy.cta_label}: ${copy.cta_href}`,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error("[reengagement] Resend failed", { to, status: res.status, errText })
    return "logged"
  }
  return "sent"
}

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // Vercel's own scheduled trigger sets this header.
  if (request.headers.get("x-vercel-cron")) return true
  if (!secret) return false
  const auth = request.headers.get("authorization") || ""
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Missing Supabase service credentials" }, { status: 500 })
  }

  const supabase = createServiceClient(url, key, { auth: { persistSession: false } })
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Pull every profile that hasn't been active in at least 7 days. We filter
  // further in-app so each user's stage is computed against the freshest
  // pipeline snapshot, not a stale DB view.
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, last_activity_at, reengagement_stage, offer_id")
    .lte("last_activity_at", sevenDaysAgo)
    .returns<DormantProfile[]>()

  if (error) {
    console.error("[reengagement] profile query failed", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<Record<string, unknown>> = []

  for (const profile of profiles || []) {
    const days = daysBetween(profile.last_activity_at, now)
    const stage = stageForDays(days)
    if (!stage) continue

    // Don't re-send the same stage. reengagement_stage stores the LAST stage
    // sent, so advancing 7 → 14 → 30 is allowed but 14 → 14 is not.
    if (profile.reengagement_stage === stage) continue

    if (!profile.email) continue

    const pipeline = await getPipelineStage(supabase, profile.id)
    const firstName = profile.full_name?.split(" ")[0] || profile.email.split("@")[0]
    const copy = composeEmail(stage, pipeline, firstName)
    const outcome = await sendEmail(profile.email, copy)

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        reengagement_stage: stage,
        last_reengagement_sent_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    if (updateErr) console.error("[reengagement] profile update failed", { userId: profile.id, updateErr })

    results.push({ userId: profile.id, stage, pipeline, days, outcome })
  }

  return NextResponse.json({ processed: results.length, results })
}
