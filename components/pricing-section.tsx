"use client"
import { useState } from "react"
import Link from "next/link"

export function PricingSection() {
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly")

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "4px", marginBottom: "24px" }}>
        <button
          onClick={() => setPlan("monthly")}
          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "14px", background: plan === "monthly" ? "#00AAFF" : "transparent", color: plan === "monthly" ? "#000" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }}
        >
          Monthly — $199/mo
        </button>
        <button
          onClick={() => setPlan("annual")}
          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "14px", background: plan === "annual" ? "#00AAFF" : "transparent", color: plan === "annual" ? "#000" : "rgba(255,255,255,0.4)", transition: "all 0.2s" }}
        >
          Annual — $1,990/yr
          <span style={{ marginLeft: "8px", fontSize: "11px", background: "rgba(34,197,94,0.2)", color: "#22c55e", padding: "2px 6px", borderRadius: "10px" }}>
            Save $398
          </span>
        </button>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "32px", marginBottom: "16px" }}>
        <div style={{ marginBottom: "24px" }}>
          <p style={{ color: "white", fontSize: "40px", fontWeight: "900", margin: "0 0 4px" }}>
            {plan === "monthly" ? "$199" : "$166"}
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "16px", fontWeight: "400" }}>
              /month{plan === "annual" ? " billed annually" : ""}
            </span>
          </p>
          {plan === "annual" && (
            <p style={{ color: "#22c55e", fontSize: "13px", margin: 0 }}>You save $398 per year</p>
          )}
        </div>

        {[
          "Free onboarding call with the Aether team",
          "AI-powered offer builder and outreach system",
          "1,300+ niche database with full pipeline",
          "Coffee Date Demo with presentation mode",
          "AI Audit tool — send branded audits to clients",
          "Quiz funnel for automated lead generation",
          "Mission Control — daily AI sprint guidance",
          "All future updates included",
        ].map(item => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" fill="rgba(0,170,255,0.1)" stroke="rgba(0,170,255,0.3)" strokeWidth="1"/>
              <path d="M5 8l2 2 4-4" stroke="#00AAFF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>{item}</span>
          </div>
        ))}

        <Link
          href="/signup"
          style={{ display: "block", background: "#00AAFF", color: "#000", fontWeight: "800", fontSize: "16px", padding: "16px", borderRadius: "10px", textDecoration: "none", textAlign: "center", marginTop: "24px" }}
        >
          Start 14-day free trial →
        </Link>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "12px", textAlign: "center", marginTop: "10px" }}>
          No credit card required during trial
        </p>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "16px 20px", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: "0 0 4px" }}>
          Have a discount code?
        </p>
        <Link href="/signup" style={{ color: "#00AAFF", fontSize: "13px", fontWeight: "600", textDecoration: "none" }}>
          Sign up and enter your code at checkout →
        </Link>
      </div>
    </div>
  )
}
