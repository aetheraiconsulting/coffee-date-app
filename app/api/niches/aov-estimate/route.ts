import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const nicheName: string | undefined = body?.niche_name
  if (!nicheName || typeof nicheName !== "string") {
    return NextResponse.json({ error: "Niche name required" }, { status: 400 })
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system: `You are a commercial research analyst providing realistic business metrics for market research.
You give typical industry benchmarks based on publicly available business data.
Return valid JSON only. No markdown. No explanation.`,
        messages: [
          {
            role: "user",
            content: `Provide typical industry benchmarks for this business niche: "${nicheName}"

Return realistic averages in this exact JSON format:

{
  "average_order_value": number,
  "aov_currency": "USD",
  "aov_notes": "one sentence explaining what an order/customer means in this niche and why this value is typical",
  "database_size_low": number,
  "database_size_high": number,
  "database_size_notes": "one sentence explaining typical customer database size for a mid-sized business in this niche",
  "dormant_percentage": number,
  "dormant_notes": "one sentence explaining what percentage of their database typically goes dormant in 12 months",
  "reactivation_rate": number,
  "reactivation_notes": "one sentence on realistic reactivation rates from AI-driven SMS campaigns in this niche"
}

Guidelines:
- average_order_value: USD value per transaction/customer/patient/client
- database_size_low/high: typical range for a business with 2-20 employees in this niche
- dormant_percentage: integer 0-100 representing typical dormant rate over 12 months
- reactivation_rate: integer 0-100 representing realistic reactivation percentage from AI SMS
- Be honest and realistic, not optimistic. These numbers will drive commercial decisions.
- For niches with highly variable values (e.g. legal services, construction), give the median typical case.
- Keep notes short — one sentence each.

Example for "Dental Practices":
{
  "average_order_value": 380,
  "aov_currency": "USD",
  "aov_notes": "Average value of a patient treatment, combining regular check-ups and occasional restorative work",
  "database_size_low": 2000,
  "database_size_high": 5000,
  "database_size_notes": "Typical patient database for a 2-chair family practice operating 5-15 years",
  "dormant_percentage": 35,
  "dormant_notes": "Approximately a third of patients have not booked in over 12 months in most practices",
  "reactivation_rate": 12,
  "reactivation_notes": "Well-targeted SMS reactivation typically recovers 10-15% of dormant patients"
}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      console.error("[v0] aov-estimate upstream error:", response.status, errText)
      return NextResponse.json(
        { error: "Claude request failed", status: response.status },
        { status: 502 },
      )
    }

    const data = await response.json()
    const text: string = data?.content?.[0]?.text ?? ""
    if (!text) {
      return NextResponse.json({ error: "Empty response from Claude" }, { status: 502 })
    }

    // Strip fenced code blocks and any accidental <cite> tags.
    const clean = text
      .replace(/```json|```/g, "")
      .replace(/<cite\b[^>]*\/>/gi, "")
      .replace(/<cite\b[^>]*>/gi, "")
      .replace(/<\/cite>/gi, "")
      .trim()

    let estimates: any
    try {
      estimates = JSON.parse(clean)
    } catch (e) {
      console.error("[v0] aov-estimate JSON parse failed:", clean)
      return NextResponse.json({ error: "Failed to parse Claude response" }, { status: 502 })
    }

    // Coerce the numeric fields defensively so the client can assume types.
    const toNum = (v: any) => (typeof v === "number" ? v : Number(v))
    const toInt = (v: any, min = 0, max = 100) => {
      const n = Math.round(toNum(v))
      if (Number.isNaN(n)) return 0
      return Math.max(min, Math.min(max, n))
    }

    return NextResponse.json({
      average_order_value: toNum(estimates.average_order_value) || 0,
      aov_currency: typeof estimates.aov_currency === "string" ? estimates.aov_currency : "USD",
      aov_notes: String(estimates.aov_notes ?? ""),
      database_size_low: toNum(estimates.database_size_low) || 0,
      database_size_high: toNum(estimates.database_size_high) || 0,
      database_size_notes: String(estimates.database_size_notes ?? ""),
      dormant_percentage: toInt(estimates.dormant_percentage),
      dormant_notes: String(estimates.dormant_notes ?? ""),
      reactivation_rate: toInt(estimates.reactivation_rate),
      reactivation_notes: String(estimates.reactivation_notes ?? ""),
    })
  } catch (error: any) {
    console.error("[v0] aov-estimate error:", error?.message || error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
