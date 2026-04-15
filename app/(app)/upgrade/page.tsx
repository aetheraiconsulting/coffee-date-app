"use client"
import { useState } from "react"

export default function UpgradePage() {
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly")
  const [promoCode, setPromoCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, promo_code: promoCode })
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError("Something went wrong. Please try again.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-16 px-6">
      <div className="text-center mb-10">
        <p className="text-[#00AAFF] text-xs font-semibold uppercase tracking-wider mb-3">
          Aether Revive
        </p>
        <h1 className="text-3xl font-bold text-white mb-3">
          Start your 14-day sprint
        </h1>
        <p className="text-white/50">
          Full access free for 14 days. No card charged until trial ends.
        </p>
      </div>

      {/* Plan toggle */}
      <div className="flex gap-2 bg-white/5 rounded-xl p-1.5 mb-6">
        <button
          onClick={() => setPlan("monthly")}
          className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${
            plan === "monthly"
              ? "bg-[#00AAFF] text-black"
              : "text-white/50 hover:text-white"
          }`}
        >
          Monthly — $199/mo
        </button>
        <button
          onClick={() => setPlan("annual")}
          className={`flex-1 py-3 rounded-lg text-sm font-semibold transition-all ${
            plan === "annual"
              ? "bg-[#00AAFF] text-black"
              : "text-white/50 hover:text-white"
          }`}
        >
          <span>Annual — $1,990/yr</span>
          <span className="ml-2 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
            Save $398
          </span>
        </button>
      </div>

      {/* What is included */}
      <div className="border border-white/10 rounded-xl p-6 mb-5">
        <p className="text-white font-semibold mb-4">Everything included:</p>
        {[
          "Free onboarding call with the Aether team",
          "AI-powered offer builder and outreach system",
          "1,300+ niche database with pipeline tracking",
          "Coffee Date Demo with presentation mode",
          "AI Audit tool — send branded audits to clients",
          "Shareable quiz funnel for lead generation",
          "Dead lead revival via GoHighLevel",
          "Mission Control — daily AI sprint guidance",
          "All future updates included",
        ].map(item => (
          <div key={item} className="flex items-center gap-3 mb-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <circle cx="8" cy="8" r="7" fill="rgba(0,170,255,0.15)" stroke="rgba(0,170,255,0.4)" strokeWidth="1"/>
              <path d="M5 8l2 2 4-4" stroke="#00AAFF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-white/65 text-sm">{item}</span>
          </div>
        ))}
      </div>

      {/* Promo code */}
      <div className="mb-5">
        <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">
          Student or promo code (optional)
        </label>
        <input
          value={promoCode}
          onChange={e => setPromoCode(e.target.value.toUpperCase())}
          placeholder="Enter code e.g. STUDENT2026"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-[#00AAFF]/50 outline-none"
        />
        <p className="text-white/25 text-xs mt-1.5">
          Students get 12 months completely free
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4 text-center">{error}</p>
      )}

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-[#00AAFF] text-black font-bold text-lg py-4 rounded-xl hover:bg-[#00AAFF]/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Redirecting to Stripe..." : "Start 14-day free trial →"}
      </button>
      <p className="text-white/20 text-xs text-center mt-3">
        No credit card charged during trial · Cancel anytime
      </p>
    </div>
  )
}
