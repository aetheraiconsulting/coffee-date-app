"use client"

// Phase 4H — Aether Team Support System
// -------------------------------------------------------------------------
// The SupportRequestModal is the single entry point for every "I want
// delivery help from the Aether Team" CTA across the product. It is
// mounted on both the Agent Library ("Deploy this agent" → modal → "Get
// Aether Team help") and the audit builder (contextual trigger below
// service recommendations). The context that drove the open — agent,
// audit, client name, niche — is passed in via `initialContext` and
// persisted on the `support_requests` row so the Aether Team email
// notification has everything needed to triage without going back and
// forth with the operator.
// -------------------------------------------------------------------------

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { X } from "lucide-react"

export interface SupportRequestContext {
  request_type: "agent_deployment" | "audit_delivery" | "general_support" | "custom"
  agent_id?: string
  agent_name?: string
  agent_slug?: string
  audit_id?: string
  client_business_name?: string
  client_niche?: string
  estimated_deal_value?: number
}

interface Props {
  open: boolean
  onClose: () => void
  initialContext?: SupportRequestContext | null
}

type InvolvementLevel = "guidance" | "assistance" | "full_delivery"

// Copy + revenue share mapping rendered in the selector and terms block.
// Kept in one place so changes to pricing terms update every surface.
const INVOLVEMENT_OPTIONS: Record<
  InvolvementLevel,
  { label: string; share: string; description: string }
> = {
  guidance: {
    label: "Guidance only",
    share: "10% revenue share",
    description:
      "We advise on implementation strategy and review your build. You do the work.",
  },
  assistance: {
    label: "Delivery assistance",
    share: "30% revenue share",
    description:
      "We handle the complex technical parts (AI prompt engineering, GHL workflow logic, integrations). You handle client communication and setup.",
  },
  full_delivery: {
    label: "Full delivery",
    share: "50% revenue share",
    description:
      "We build and deliver the entire agent for your client. You focus on closing more deals.",
  },
}

export function SupportRequestModal({ open, onClose, initialContext }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const [submitting, setSubmitting] = useState(false)
  const [canRequest, setCanRequest] = useState(false)
  const [checkingAccess, setCheckingAccess] = useState(true)

  const [involvementLevel, setInvolvementLevel] = useState<InvolvementLevel>("assistance")
  const [clientBusiness, setClientBusiness] = useState("")
  const [clientNiche, setClientNiche] = useState("")
  const [estimatedValue, setEstimatedValue] = useState<string>("")
  const [userNotes, setUserNotes] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // Every time the modal opens we refresh the form against the current
  // initialContext. This way the same mounted instance can be re-used
  // for multiple different triggers without stale defaults leaking
  // between openings (e.g. close from audit trigger → open from agent
  // deploy modal → the agent name should replace the audit name).
  useEffect(() => {
    if (!open) return
    setClientBusiness(initialContext?.client_business_name || "")
    setClientNiche(initialContext?.client_niche || "")
    setEstimatedValue(
      initialContext?.estimated_deal_value != null
        ? String(initialContext.estimated_deal_value)
        : "",
    )
    setUserNotes("")
    setAcceptedTerms(false)
    setInvolvementLevel("assistance")
    checkEligibility()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialContext])

  async function checkEligibility() {
    setCheckingAccess(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setCanRequest(false)
      setCheckingAccess(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, promo_code_used")
      .eq("id", user.id)
      .maybeSingle()

    // `promo_code_used` is a text column holding the applied code (or
    // null). Treat any non-empty value as "promo redeemed". We also
    // accept `trialing` so users still inside their Stripe trial can
    // request help — they're paying customers-in-waiting.
    const eligible =
      !!profile &&
      (profile.subscription_status === "active" ||
        profile.subscription_status === "admin" ||
        profile.subscription_status === "trialing" ||
        profile.subscription_status === "student" ||
        (typeof profile.promo_code_used === "string" &&
          profile.promo_code_used.trim().length > 0))

    setCanRequest(eligible)
    setCheckingAccess(false)
  }

  async function handleSubmit() {
    if (!acceptedTerms) {
      toast({
        title: "Terms acceptance required",
        description: "Please accept the revenue share terms to submit your request.",
        variant: "destructive",
      })
      return
    }
    if (!clientBusiness.trim() || !userNotes.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide the client business name and describe what you need.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    const { data: request, error } = await supabase
      .from("support_requests")
      .insert({
        user_id: user.id,
        request_type: initialContext?.request_type || "general_support",
        involvement_level: involvementLevel,
        agent_id: initialContext?.agent_id || null,
        audit_id: initialContext?.audit_id || null,
        client_business_name: clientBusiness.trim(),
        client_niche: clientNiche.trim() || null,
        estimated_deal_value: estimatedValue ? parseInt(estimatedValue, 10) : null,
        user_notes: userNotes.trim(),
        user_subscription_status: profile?.subscription_status ?? null,
        status: "submitted",
        metadata: {
          agent_name: initialContext?.agent_name ?? null,
          agent_slug: initialContext?.agent_slug ?? null,
          submitted_from: initialContext?.request_type || "general_support",
          user_name: profile?.full_name ?? null,
          user_email: profile?.email ?? null,
        },
      })
      .select()
      .single()

    if (error || !request) {
      toast({
        title: "Could not submit request",
        description: error?.message || "Please try again in a moment.",
        variant: "destructive",
      })
      setSubmitting(false)
      return
    }

    // Fire-and-forget email to the Aether Team. We don't block the user
    // on this: if the server has no RESEND_API_KEY the endpoint returns
    // `{ sent: false, reason: "no_resend_key" }` but the support row is
    // already persisted and visible in /support-requests.
    try {
      await fetch("/api/support/notify-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ support_request_id: request.id }),
      })
    } catch {
      // Silent — the request is saved, admin will still see it in their
      // admin view even if the notification email fails.
    }

    toast({
      title: "Request submitted",
      description: "The Aether Team will reach out within 24 hours via email.",
    })

    setSubmitting(false)
    onClose()
    router.push("/support-requests")
  }

  if (!open) return null

  // Access-check state: brief loading card while we read the profile.
  if (checkingAccess) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-6">
        <div className="bg-[#0F1318] border border-white/10 rounded-xl p-6">
          <p className="text-white/40 text-sm">Checking access...</p>
        </div>
      </div>
    )
  }

  // Ineligible state: non-subscribers see an upgrade prompt rather than
  // the form. This is a hard gate — Aether Team delivery is a paid
  // feature and should not appear to leak to free users.
  if (!canRequest) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-6">
        <div className="bg-[#0F1318] border border-white/10 rounded-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider">
              Subscription required
            </p>
            <button
              onClick={onClose}
              className="text-white/30 hover:text-white/60 text-xl leading-none"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-white font-bold mb-2">
            Aether Team support is available to active subscribers
          </p>
          <p className="text-white/50 text-sm mb-5 leading-relaxed">
            To request delivery help from the Aether Team, you need an active
            subscription. This ensures we work with committed operators who are
            serious about scaling their AI service business.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 border border-white/10 text-white/70 font-semibold py-3 rounded-lg hover:bg-white/10 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => router.push("/upgrade")}
              className="flex-1 bg-[#00AAFF] text-black font-bold py-3 rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
            >
              Start subscription →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main submit state.
  const involvement = INVOLVEMENT_OPTIONS[involvementLevel]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-6 overflow-y-auto">
      <div className="bg-[#0F1318] border border-white/10 rounded-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-1">
              Aether Team support
            </p>
            <p className="text-white font-bold text-lg leading-snug">
              {initialContext?.agent_name
                ? `Request help deploying ${initialContext.agent_name}`
                : "Request Aether Team help"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 flex-shrink-0"
            aria-label="Close support request modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Involvement level selector — primary decision on the form */}
        <div className="mb-5">
          <label className="text-white/40 text-xs uppercase tracking-wider block mb-3">
            Level of involvement needed
          </label>
          <div className="space-y-2">
            {(Object.keys(INVOLVEMENT_OPTIONS) as InvolvementLevel[]).map((key) => {
              const opt = INVOLVEMENT_OPTIONS[key]
              const selected = involvementLevel === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setInvolvementLevel(key)}
                  className={`w-full text-left border rounded-lg p-4 transition-colors ${
                    selected
                      ? "border-[#00AAFF]/50 bg-[#00AAFF]/10"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <p className="text-white font-semibold">{opt.label}</p>
                    <span className="text-[#00AAFF] text-xs font-bold whitespace-nowrap">
                      {opt.share}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {opt.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Client context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
              Client business name *
            </label>
            <input
              value={clientBusiness}
              onChange={(e) => setClientBusiness(e.target.value)}
              placeholder="e.g. Mitchell Family Dental"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg p-3 text-white text-sm placeholder:text-white/30 focus:border-[#00AAFF]/40 outline-none"
            />
          </div>
          <div>
            <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
              Client niche
            </label>
            <input
              value={clientNiche}
              onChange={(e) => setClientNiche(e.target.value)}
              placeholder="e.g. Dental Practices"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg p-3 text-white text-sm placeholder:text-white/30 focus:border-[#00AAFF]/40 outline-none"
            />
          </div>
        </div>

        {/* Estimated deal value */}
        <div className="mb-5">
          <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
            Estimated deal value (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              $
            </span>
            <input
              type="number"
              min={0}
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg pl-7 pr-3 py-3 text-white text-sm placeholder:text-white/30 focus:border-[#00AAFF]/40 outline-none"
            />
          </div>
          <p className="text-white/30 text-xs mt-1.5">
            Total expected value over the engagement. Helps us prioritize our response.
          </p>
        </div>

        {/* Notes */}
        <div className="mb-5">
          <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
            What do you need? *
          </label>
          <textarea
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder="Describe the client situation, what they need, and where you need support. Be specific about what you can handle yourself vs what you need help with."
            rows={5}
            className="w-full bg-white/[0.03] border border-white/10 rounded-lg p-3 text-white text-sm leading-relaxed placeholder:text-white/30 focus:border-[#00AAFF]/40 outline-none"
          />
        </div>

        {/* Terms acceptance — gated submit */}
        <div className="border border-amber-400/20 bg-amber-400/5 rounded-lg p-4 mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 flex-shrink-0"
            />
            <div>
              <p className="text-amber-300 text-sm font-semibold mb-1">
                I accept the revenue share terms
              </p>
              <p className="text-amber-300/70 text-xs leading-relaxed">
                By submitting this request, I agree that if the Aether Team
                provides support as requested and the deal with my client closes,
                I will pay the Aether Team the agreed revenue share percentage (
                {involvement.share}) of the deal value. Specific commercial terms
                will be formalized in an engagement agreement before work begins.
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white/5 border border-white/10 text-white/70 font-semibold py-3 rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !acceptedTerms ||
              !clientBusiness.trim() ||
              !userNotes.trim()
            }
            className="flex-1 bg-[#00AAFF] text-black font-bold py-3 rounded-lg hover:bg-[#00AAFF]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit request →"}
          </button>
        </div>
      </div>
    </div>
  )
}
