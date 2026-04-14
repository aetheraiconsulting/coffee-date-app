"use client"

import { useParams } from "next/navigation"
import ProspectAuditForm from "@/components/prospect-audit-form"

export default function SubdomainAuditPage() {
  const params = useParams()
  const subdomain = params.subdomain as string

  return <ProspectAuditForm subdomain={subdomain} />
}
