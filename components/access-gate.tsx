"use client"

import { useRouter } from "next/navigation"
import { Lock, ArrowRight } from "lucide-react"

interface AccessGateProps {
  feature: string
  description?: string
}

/**
 * Soft feature-gate UI. Shown in place of a generation CTA when the user's
 * `accessLevel` is "limited" — they keep full read access to existing data
 * but cannot create anything new until they subscribe.
 */
export function AccessGate({ feature, description }: AccessGateProps) {
  const router = useRouter()

  return (
    <div className="border border-[#00AAFF]/30 bg-[#00AAFF]/[0.05] rounded-xl p-6 my-6">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="h-3.5 w-3.5 text-[#00AAFF]" />
        <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider">
          Subscription required
        </p>
      </div>
      <p className="text-white font-bold text-lg mb-2 text-pretty">
        Upgrade to keep using {feature}
      </p>
      <p className="text-white/50 text-sm mb-5 leading-relaxed text-pretty">
        {description ||
          "Your free trial has ended. Subscribe to continue creating new content — your existing data is safe and still accessible."}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push("/upgrade")}
          className="inline-flex items-center gap-2 bg-[#00AAFF] hover:bg-[#0099EE] text-black font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Start subscription
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="inline-flex items-center bg-white/[0.05] border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08] font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  )
}
