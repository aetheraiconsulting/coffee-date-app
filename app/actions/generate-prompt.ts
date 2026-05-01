"use server"

import { createClient } from "@/lib/supabase/server"
import { buildCoffeeDatePrompt } from "@/lib/templates/coffee-date-template"

// Field set matches the simplified Coffee Date Android builder. Every field
// the operator supplies in the form flows through this interface unchanged.
interface PromptFormData {
  businessName: string
  websiteUrl?: string
  androidName: string
  prospectName: string
  openingServicePhrase: string
  positiveResponse: string
  negativeResponse: string
  calendarLink: string
  faq?: string
  qualifyingQuestion: string
  serviceType?: string
  companySummary?: string
  regionTone?: string
  industryTraining?: string
}

// Final safety pass on the generated Android prompt:
//  1. Strip any residual <cite ...> / </cite> tags Claude's web_search tool
//     can leak into text we later embed in the system prompt.
//  2. Replace any lingering [name] / {name} / [prospect_name] placeholders
//     with the real prospect name, so the Android never addresses the
//     prospect with a literal token during the demo.
function cleanPrompt(text: string, prospectName: string): string {
  let out = text
    .replace(/<cite\b[^>]*\/>/gi, "")
    .replace(/<cite\b[^>]*>/gi, "")
    .replace(/<\/cite>/gi, "")
    .replace(/<\/?antml:cite\b[^>]*>/gi, "")

  if (prospectName) {
    const tokens = ["[name]", "[Name]", "{name}", "{Name}", "[prospect_name]", "{prospect_name}"]
    for (const t of tokens) out = out.split(t).join(prospectName)
  }

  return out.replace(/\s{2,}/g, " ").trim()
}

export async function generatePrompt(formData: PromptFormData, userId: string) {
  const supabase = await createClient()

  try {
    // Generate the prompt using the template, then clean the output.
    const rawPrompt = buildCoffeeDatePrompt(formData)
    const prompt = cleanPrompt(rawPrompt, (formData.prospectName || "").trim())

    // Create the android with the generated prompt. The top-level `niche`
    // column is still populated from `serviceType` so downstream joins
    // (Opportunities, Pipeline, Agent Library) keep working without a
    // user-visible niche dropdown.
    const { data: android, error } = await supabase
      .from("androids")
      .insert({
        user_id: userId,
        name: formData.androidName,
        niche: formData.serviceType || null,
        prompt,
        ai_prefilled: true,
        business_context: {
          prospect_name: formData.prospectName,
          opening_service_phrase: formData.openingServicePhrase,
          positive_response: formData.positiveResponse,
          negative_response: formData.negativeResponse,
          qualifying_question: formData.qualifyingQuestion,
          faq: formData.faq || null,
          company_summary: formData.companySummary || null,
          region_tone: formData.regionTone || null,
          industry_training: formData.industryTraining || null,
          // Lightweight identity fields for demo-chat header rendering.
          businessName: formData.businessName,
          company_name: formData.businessName,
          androidName: formData.androidName,
          website: formData.websiteUrl || null,
          calendarLink: formData.calendarLink,
          // Niche slug mirror so Opportunities matching has cheap JSONB read.
          niche: formData.serviceType || null,
        },
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating android:", error)
      return { success: false, error: error.message }
    }

    return { success: true, androidId: android.id, prompt }
  } catch (error: any) {
    console.error("Error generating prompt:", error)
    return { success: false, error: error.message }
  }
}
