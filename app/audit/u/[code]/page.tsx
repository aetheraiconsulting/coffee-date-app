import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProspectAuditForm } from "@/components/prospect-audit-form"

export default async function PublicAuditByCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = await createClient()

  // Fetch user by audit_share_code
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, audit_share_code")
    .eq("audit_share_code", code)
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
      shareCode={code}
    />
  )
}
