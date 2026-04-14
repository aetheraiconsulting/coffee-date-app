"use client"

import { useParams } from "next/navigation"
import ProspectAuditForm from "@/components/prospect-audit-form"

export default function PublicAuditByCodePage() {
  const params = useParams()
  const code = params.code as string

  return <ProspectAuditForm code={code} />
}
