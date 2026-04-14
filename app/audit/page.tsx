import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ProspectAuditForm } from "@/components/prospect-audit-form"

export default async function AuditPage() {
  const headersList = await headers()
  const subdomain = headersList.get("x-subdomain")

  if (!subdomain) {
    return notFound()
  }

  const supabase = await createClient()

  // Fetch user by subdomain
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("subdomain", subdomain)
    .maybeSingle()

  if (!profile) {
    return notFound()
  }

  // Fetch branding
  const { data: branding } = await supabase
    .from("user_branding")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle()

  return (
    <ProspectAuditForm 
      userId={profile.id} 
      branding={branding}
    />
  )
}
