"use server"

import { createClient } from "@/lib/supabase/server"
import { buildCoffeeDatePrompt } from "@/lib/templates/coffee-date-template"

interface PromptFormData {
  businessName: string
  androidName: string
  prospectName?: string
  serviceType: string
  shortService: string
  nicheQuestion: string
  valueProp: string
  calendarLink: string
  regionTone: string
  industryTraining: string
  website: string
  openingHours: string
  promiseLine: string
  additionalContext?: string
  aiPrefilled?: boolean
  // Agent Library / Audit attribution
  agentId?: string | null
  agentSlug?: string | null
  agentName?: string | null
  auditId?: string | null
}

// Final safety pass on the generated Android prompt:
//  1. Strip any residual <cite ...> / </cite> / </cite> tags that Claude's
//     web_search tool can leak into text we later include in the system prompt.
//  2. Replace any lingering [name] / {name} / [prospect_name] placeholders with
//     the real prospect name, so the Android never addresses the prospect with a
//     literal token during the demo.
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

    // Create the android with the generated prompt.
    // We also populate the top-level `niche` column so other pages (e.g. the
    // Opportunities demo section) can match Androids to a niche without having
    // to unpack the `business_context` JSONB.
    const { data: android, error } = await supabase
      .from("androids")
      .insert({
        user_id: userId,
        name: formData.androidName,
        niche: formData.serviceType,
        prompt,
        ai_prefilled: formData.aiPrefilled || false,
        // Attribution columns added in migration 048. When the Android was
        // built from an Agent Library template or an audit recommendation
        // we persist the foreign keys here so the Clients / Pipeline views
        // can trace the provenance.
        agent_id: formData.agentId || null,
        audit_id: formData.auditId || null,
        business_context: {
          businessName: formData.businessName,
          company_name: formData.businessName,
          androidName: formData.androidName,
          prospect_name: formData.prospectName || null,
          serviceType: formData.serviceType,
          shortService: formData.shortService,
          niche: formData.serviceType,
          nicheQuestion: formData.nicheQuestion,
          valueProp: formData.valueProp,
          calendarLink: formData.calendarLink,
          regionTone: formData.regionTone,
          industryTraining: formData.industryTraining,
          website: formData.website,
          openingHours: formData.openingHours,
          promiseLine: formData.promiseLine,
          additionalContext: formData.additionalContext,
          // Denormalised agent/audit pointers for cheaper UI reads.
          built_from_agent: formData.agentSlug || null,
          built_from_audit: formData.auditId || null,
          agent_name: formData.agentName || null,
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
