import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

/**
 * Archive-old-drafts cron. Runs daily.
 *
 * Keeps My Outreach from turning into a junk drawer by moving any draft
 * outreach_messages older than 30 days into the archived bucket. Archived
 * rows stay in the DB (the user can still view them via the "Show archived"
 * toggle) but are filtered out of default queries.
 *
 * Only touches rows where:
 *   - status = 'draft'     (never archive sent / replied / no_reply rows)
 *   - archived = false     (idempotent — skip anything already archived)
 *   - created_at < 30 days ago
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or Vercel's `x-vercel-cron` header.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const ARCHIVE_DRAFT_AFTER_DAYS = 30

function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
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
  const cutoff = new Date(now.getTime() - ARCHIVE_DRAFT_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("outreach_messages")
    .update({ archived: true, archived_at: now.toISOString() })
    .eq("status", "draft")
    .eq("archived", false)
    .lt("created_at", cutoff)
    .select("id")

  if (error) {
    console.error("[archive-messages] update failed", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    archived: data?.length ?? 0,
    cutoff,
  })
}
