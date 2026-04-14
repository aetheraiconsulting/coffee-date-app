import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, code, subdomain, contact, answers } = body

    if (!user_id || !contact || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the quiz template
    const { data: quiz } = await supabase
      .from("quiz_templates")
      .select("id, questions, cta_text, cta_url")
      .eq("user_id", user_id)
      .eq("is_published", true)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Calculate score
    const rawScore = Object.values(answers).reduce((sum: number, val) => sum + (val as number), 0)
    const maxScore = (quiz.questions as Array<{ id: string }>).length * 10
    const normalizedScore = Math.round((rawScore / maxScore) * 100)

    // Determine tier
    let tier: "High" | "Medium" | "Low"
    if (normalizedScore >= 70) {
      tier = "High"
    } else if (normalizedScore >= 40) {
      tier = "Medium"
    } else {
      tier = "Low"
    }

    // Generate personalized message with Claude
    let resultsMessage = ""
    try {
      const anthropic = new Anthropic()
      
      // Build context about answers
      const questionAnswers = (quiz.questions as Array<{ id: string; question: string; options: Array<{ label: string; value: number }> }>)
        .map(q => {
          const selectedValue = answers[q.id]
          const selectedOption = q.options.find(o => o.value === selectedValue)
          return `Q: ${q.question}\nA: ${selectedOption?.label || "Not answered"}`
        })
        .join("\n\n")

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `You are an AI consultant. Based on these quiz responses, write a 2-3 sentence personalized results message for ${contact.firstName} from ${contact.companyName}. Their AI Readiness Score is ${normalizedScore}/100 (${tier} readiness).

Quiz Responses:
${questionAnswers}

Write a brief, encouraging message that:
1. Acknowledges their current AI readiness level
2. Highlights one specific opportunity based on their answers
3. Encourages them to book a call to discuss further

Keep it conversational and specific to their answers. Do not use generic platitudes.`
        }]
      })

      resultsMessage = (response.content[0] as { type: string; text: string }).text
    } catch (error) {
      console.error("Claude error:", error)
      // Fallback messages
      if (tier === "High") {
        resultsMessage = `Great news, ${contact.firstName}! Your business shows strong AI readiness. Let's discuss advanced implementations that could give ${contact.companyName} a competitive edge.`
      } else if (tier === "Medium") {
        resultsMessage = `Thanks ${contact.firstName}! ${contact.companyName} has a solid foundation for AI adoption. Let's identify the quick wins that will deliver the fastest ROI.`
      } else {
        resultsMessage = `${contact.firstName}, there's significant untapped potential at ${contact.companyName}. Let's discuss where AI can make the biggest immediate impact on your operations.`
      }
    }

    // Save response
    const { data: savedResponse, error: saveError } = await supabase
      .from("quiz_responses")
      .insert({
        quiz_template_id: quiz.id,
        respondent_name: contact.firstName,
        respondent_email: contact.email,
        company_name: contact.companyName,
        answers,
        score: normalizedScore,
        claude_results_message: resultsMessage
      })
      .select("id")
      .single()

    if (saveError) {
      console.error("Save error:", saveError)
    }

    // Track completion (fire and forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/quiz/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizTemplateId: quiz.id, event: "complete" })
    }).catch(() => {})

    // Sync to GHL (fire and forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/quiz/ghl-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quizTemplateId: quiz.id,
        responseId: savedResponse?.id,
        contactInfo: contact,
        answers,
        score: normalizedScore,
        scoreTier: tier
      })
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      score: normalizedScore,
      tier,
      message: resultsMessage
    })
  } catch (error) {
    console.error("Quiz submit error:", error)
    return NextResponse.json({ error: "Submission failed" }, { status: 500 })
  }
}
