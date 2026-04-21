import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { audit_id } = await request.json()

  const { data: audit } = await supabase
    .from("audits")
    .select("*")
    .eq("id", audit_id)
    .single()

  if (!audit) return NextResponse.json({ error: "Audit not found" }, { status: 404 })

  const insights = audit.edited_insights || audit.ai_insights || {}
  
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>AI Readiness Audit — ${audit.name}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 40px; max-width: 800px; margin: 0 auto; }
  .cover { background: #080B0F; color: white; padding: 60px 40px; margin: -40px -40px 40px; }
  .cover h1 { font-size: 32px; font-weight: 800; color: white; margin: 0 0 8px; }
  .cover .sub { color: #00AAFF; font-size: 14px; margin: 0 0 40px; }
  .cover .meta { font-size: 12px; color: rgba(255,255,255,0.5); }
  .section { margin-bottom: 32px; }
  .section-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #00AAFF; font-weight: 700; margin-bottom: 8px; }
  h2 { font-size: 18px; font-weight: 700; color: #1a1a2e; margin: 0 0 12px; }
  p { font-size: 13px; line-height: 1.7; color: #444; margin: 0 0 8px; }
  .card { background: #f8f9fa; border-left: 3px solid #00AAFF; padding: 16px 20px; margin-bottom: 12px; border-radius: 0 8px 8px 0; }
  .card h3 { font-size: 14px; font-weight: 700; margin: 0 0 6px; color: #1a1a2e; }
  .card p { font-size: 12px; color: #666; margin: 0; }
  .priority-critical { border-left-color: #E24B4A; }
  .priority-high { border-left-color: #BA7517; }
  .priority-medium { border-left-color: #00AAFF; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-bottom: 6px; }
  .badge-critical { background: #FCEBEB; color: #A32D2D; }
  .badge-high { background: #FAEEDA; color: #633806; }
  .badge-medium { background: #E6F1FB; color: #0C447C; }
  .financial { background: #080B0F; color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px; }
  .financial h3 { color: #00AAFF; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 8px; }
  .financial p { color: rgba(255,255,255,0.8); font-size: 14px; margin: 0; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; }
  @media print { body { padding: 20px; } .cover { margin: -20px -20px 30px; } }
</style>
</head>
<body>

<div class="cover">
  <p class="sub">AI READINESS AUDIT REPORT</p>
  <h1>${audit.name}</h1>
  <div class="meta">
    <p>Industry: ${audit.industry || "Not specified"} &nbsp;|&nbsp; Business size: ${audit.business_size || "Not specified"}</p>
    <p>Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
    <p>Prepared by: Aether AI Lab</p>
  </div>
</div>

<div class="section">
  <div class="section-label">Executive Summary</div>
  <p>${insights.executive_summary || ""}</p>
</div>

<div class="financial">
  <h3>Financial Impact Estimate</h3>
  <p>${insights.financial_impact || ""}</p>
</div>

<div class="section">
  <h2>Key Bottlenecks Identified</h2>
  ${(insights.bottlenecks || []).map((b: { issue?: string; evidence?: string; impact?: string } | string) => `
    <div class="card">
      <h3>${typeof b === 'string' ? b : (b.issue || '')}</h3>
      ${typeof b === 'object' && b.evidence ? `<p><strong>Evidence:</strong> ${b.evidence}</p>` : ""}
      ${typeof b === 'object' && b.impact ? `<p><strong>Impact:</strong> ${b.impact}</p>` : ""}
    </div>
  `).join("")}
</div>

<div class="section">
  <h2>Recommended AI Services</h2>
  ${(insights.service_recommendations || []).map((s: { service?: string; priority?: string; problem_solved?: string; expected_outcome?: string; pricing_model?: string; why_now?: string }) => `
    <div class="card priority-${s.priority || 'medium'}">
      <span class="badge badge-${s.priority || 'medium'}">${(s.priority || "medium").toUpperCase()}</span>
      <h3>${s.service || ""}</h3>
      <p><strong>Problem solved:</strong> ${s.problem_solved || ""}</p>
      <p><strong>Expected outcome:</strong> ${s.expected_outcome || ""}</p>
      <p><strong>Pricing model:</strong> ${s.pricing_model || ""}</p>
      <p><strong>Why now:</strong> ${s.why_now || ""}</p>
    </div>
  `).join("")}
</div>

<div class="section">
  <h2>Quick Wins</h2>
  ${(insights.quick_wins || []).map((q: { action?: string; timeline?: string; outcome?: string } | string) => `
    <div class="card">
      <h3>${typeof q === 'string' ? q : (q.action || '')}</h3>
      ${typeof q === 'object' && q.timeline ? `<p><strong>Timeline:</strong> ${q.timeline}</p>` : ""}
      ${typeof q === 'object' && q.outcome ? `<p><strong>Outcome:</strong> ${q.outcome}</p>` : ""}
    </div>
  `).join("")}
</div>

<div class="section">
  <h2>90-Day Implementation Roadmap</h2>
  ${(insights.roadmap || []).map((r: { phase?: string; focus?: string; outcome?: string } | string) => `
    <div class="card">
      <h3>${typeof r === 'string' ? r : (r.phase || '')}</h3>
      ${typeof r === 'object' && r.focus ? `<p><strong>Focus:</strong> ${r.focus}</p>` : ""}
      ${typeof r === 'object' && r.outcome ? `<p><strong>Expected outcome:</strong> ${r.outcome}</p>` : ""}
    </div>
  `).join("")}
</div>

<div class="footer">
  <p>This report was prepared by Aether AI Lab. All recommendations are based on information provided during the AI Readiness Audit.</p>
  <p>For questions about implementation, contact your Aether AI consultant.</p>
</div>

</body>
</html>`

  // Update report_ready flag
  await supabase
    .from("audits")
    .update({ report_ready: true })
    .eq("id", audit_id)

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="${audit.name}-AI-Audit-Report.html"`,
    }
  })
}
