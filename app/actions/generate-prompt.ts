"use server"

import { createClient } from "@/lib/supabase/server"
import { buildCoffeeDatePrompt } from "@/lib/templates/coffee-date-template"

interface PromptFormData {
  businessName: string
  androidName: string
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
}

export async function generatePrompt(formData: PromptFormData, userId: string) {
  const supabase = await createClient()

  try {
    // Generate the prompt using the template
    const prompt = buildCoffeeDatePrompt(formData)

    // Create the android with the generated prompt
    const { data: android, error } = await supabase
      .from("androids")
      .insert({
        user_id: userId,
        name: formData.androidName,
        prompt,
        ai_prefilled: formData.aiPrefilled || false,
        business_context: {
          businessName: formData.businessName,
          company_name: formData.businessName,
          androidName: formData.androidName,
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
