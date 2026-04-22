// Phase 4H — Aether Team support request email notifier
// -------------------------------------------------------------------------
// POST /api/support/notify-team
// Body: { support_request_id: string }
//
// Fetches the support_requests row (joined to agents/audits/profile) and
// sends an HTML email to the Aether Team admins via Resend. The endpoint
// is idempotent-safe but does not de-duplicate — the modal calls it
// exactly once on submit. If the RESEND_API_KEY env var is missing we
// return { sent: false, reason: "no_resend_key" } with HTTP 200 so the
// client UX continues successfully (the support row is already
// persisted and visible in the admin surfaces).
// -------------------------------------------------------------------------

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const INVOLVEMENT_LABELS: Record<string, string> = {
  guidance: "Guidance only (10%)",
  assistance: "Delivery assistance (30%)",
  full_delivery: "Full delivery (50%)",
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let support_request_id: string | undefined
  try {
    const body = await request.json()
    support_request_id = body?.support_request_id
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (!support_request_id) {
    return NextResponse.json(
      { error: "Missing support_request_id" },
      { status: 400 },
    )
  }

  // RLS ensures users can only read their own support_requests rows,
  // so the .eq("user_id", user.id) is belt-and-suspenders — but it also
  // gives us a clear 404 when someone passes another user's id.
  const { data: req } = await supabase
    .from("support_requests")
    .select(
      "*, agents(name, slug, typical_deployment_hours, complexity_level), audits(name, industry)",
    )
    .eq("id", support_request_id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!req) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, subscription_status")
    .eq("id", user.id)
    .maybeSingle()

  if (!process.env.RESEND_API_KEY) {
    // No email configured — return success so the client flow completes.
    // Admin can still see the new row via the /support-requests admin
    // view or directly in Supabase.
    return NextResponse.json({ sent: false, reason: "no_resend_key" })
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://aetherrevive.com"
  const adminEmails = ["adam@aetherai.consulting", "anjal@aetherai.consulting"]

  const involvementLabel =
    INVOLVEMENT_LABELS[req.involvement_level] || req.involvement_level
  const requestTypeLabel =
    req.agents?.name ||
    req.audits?.name ||
    (req.request_type || "support").replace(/_/g, " ")

  // Conditional fragments kept as separate strings so the template
  // reads cleanly even when some fields are missing.
  const nicheLine = req.client_niche
    ? `<p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 4px;"><strong>Niche:</strong> ${escapeHtml(req.client_niche)}</p>`
    : ""
  const dealValueLine =
    req.estimated_deal_value != null
      ? `<p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 4px;"><strong>Estimated value:</strong> $${Number(req.estimated_deal_value).toLocaleString("en-US")}</p>`
      : ""
  const deploymentLine = req.agents?.typical_deployment_hours
    ? `<p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 4px;"><strong>Typical deployment:</strong> ${req.agents.typical_deployment_hours} hours (${escapeHtml(req.agents.complexity_level || "—")})</p>`
    : ""

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #0F1318; color: white;">
      <div style="padding: 20px 0 24px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <p style="color: #00AAFF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">
          New support request
        </p>
      </div>

      <h2 style="color: white; font-size: 22px; font-weight: 700; margin: 24px 0 8px;">
        ${escapeHtml(req.client_business_name)}
      </h2>
      <p style="color: rgba(255,255,255,0.5); font-size: 14px; margin: 0 0 24px;">
        ${escapeHtml(requestTypeLabel)} &middot; ${escapeHtml(involvementLabel)}
      </p>

      <div style="background: rgba(0,170,255,0.05); border: 1px solid rgba(0,170,255,0.2); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px;">From</p>
        <p style="color: white; font-weight: 600; margin: 0 0 2px;">${escapeHtml(profile?.full_name || "Unknown user")}</p>
        <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin: 0;">${escapeHtml(profile?.email || "")}</p>
        <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 4px 0 0;">Subscription: ${escapeHtml(profile?.subscription_status || "—")}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px;">Context</p>
        ${nicheLine}
        ${dealValueLine}
        ${deploymentLine}
      </div>

      <div style="margin-bottom: 24px;">
        <p style="color: rgba(255,255,255,0.4); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px;">Message</p>
        <p style="color: white; font-size: 15px; line-height: 1.6; background: rgba(255,255,255,0.03); padding: 16px; border-left: 2px solid rgba(255,255,255,0.1); margin: 0; white-space: pre-wrap;">
          ${escapeHtml(req.user_notes || "")}
        </p>
      </div>

      <a href="${appUrl}/admin/support-requests/${req.id}" style="display: inline-block; background: #00AAFF; color: #000; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        Review in admin →
      </a>

      <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
        Submitted ${new Date(req.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. User is expecting a response within 24 hours.
      </p>
    </div>
  `

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Aether Revive <support@aetherrevive.com>",
        to: adminEmails,
        subject: `Support request from ${profile?.full_name || "user"}: ${req.client_business_name}`,
        html,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return NextResponse.json({ sent: false, error: text || res.statusText })
    }
    return NextResponse.json({ sent: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ sent: false, error: message })
  }
}

// Minimal HTML escape — we interpolate user-supplied strings (business
// name, notes, niche) into the email template so we need to prevent HTML
// injection even though the audience is internal admins.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
