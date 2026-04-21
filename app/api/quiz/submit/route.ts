import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { upsertProspect } from "@/lib/createProspect"
import { createNotification } from "@/lib/createNotification"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quizTemplateId, contactInfo, answers, score } = body

    // Determine score tier
    let scoreTier = "Low"
    if (score >= 80) scoreTier = "High"
    else if (score >= 40) scoreTier = "Medium"

    // Look up the template owner so we can attribute the prospect + notification.
    const { data: template } = await supabase
      .from("quiz_templates")
      .select("user_id, title")
      .eq("id", quizTemplateId)
      .maybeSingle()

    // Save response to database
    const { data: response, error } = await supabase
      .from("quiz_responses")
      .insert({
        quiz_template_id: quizTemplateId,
        respondent_name: contactInfo.firstName,
        respondent_email: contactInfo.email,
        company_name: contactInfo.companyName,
        answers: answers,
        score: score,
      })
      .select()
      .single()

    if (error) throw error

    // Side-effects (fire-and-forget — don't block the prospect's success path).
    if (template?.user_id && contactInfo?.email) {
      await upsertProspect({
        user_id: template.user_id,
        email: contactInfo.email,
        name: contactInfo.firstName ?? null,
        business: contactInfo.companyName ?? null,
        source: "quiz",
        source_id: response.id,
        extraMetadata: {
          quiz_template_id: quizTemplateId,
          score,
          score_tier: scoreTier,
        },
      })

      await createNotification(
        {
          user_id: template.user_id,
          type: "prospect_quiz_completed",
          title: `Quiz completed — ${scoreTier} score`,
          body: `${contactInfo.firstName || contactInfo.email} scored ${score} on ${template.title || "your quiz"}.`,
          action_href: `/quiz/responses/${response.id}`,
          related_id: response.id,
        },
        { useServiceRole: true },
      )
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin
    fetch(`${origin}/api/quiz/ghl-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizTemplateId,
        responseId: response.id,
        contactInfo,
        answers,
        score,
        scoreTier,
      }),
    }).catch((err) => console.error("[v0] GHL sync fire-and-forget error:", err))

    return NextResponse.json({
      success: true,
      responseId: response.id,
      score,
      scoreTier,
    })
  } catch (error) {
    console.error("[v0] Quiz submit error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
