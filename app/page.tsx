import Link from "next/link"
import { PricingSection } from "@/components/pricing-section"

export default function HomePage() {
  return (
    <div style={{ background: "#080B0F", minHeight: "100vh", color: "white" }}>

      {/* NAVIGATION */}
      <nav style={{ background: "rgba(8,11,15,0.95)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 50, padding: "0 24px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <img 
              src="/images/aether-revive-logo.png" 
              alt="Aether Revive" 
              style={{ height: "72px", width: "auto", objectFit: "contain" }} 
            />
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <a href="#pricing" style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", textDecoration: "none", padding: "8px 16px" }}>
              Pricing
            </a>
            <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", textDecoration: "none", padding: "8px 16px" }}>
              Sign in
            </Link>
            <Link href="/signup" style={{ background: "#00AAFF", color: "#000", fontWeight: "700", fontSize: "14px", padding: "8px 20px", borderRadius: "8px", textDecoration: "none" }}>
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 24px", textAlign: "center", maxWidth: "760px", margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0,170,255,0.08)", border: "0.5px solid rgba(0,170,255,0.2)", borderRadius: "20px", padding: "6px 14px", fontSize: "12px", color: "#00AAFF", fontWeight: "600", marginBottom: "24px", letterSpacing: "0.5px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#00AAFF" }} />
          AI CLIENT ACQUISITION SYSTEM
        </div>

        <h1 style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: "900", color: "white", lineHeight: "1.1", margin: "0 0 20px", letterSpacing: "-1px" }}>
          Stop trying to figure out AI.
          <br />
          <span style={{ color: "#00AAFF" }}>Get your first client instead.</span>
        </h1>

        <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: "rgba(255,255,255,0.5)", lineHeight: "1.6", margin: "0 0 36px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
          A step-by-step system that tells you exactly what to do, writes everything for you, and gets you to your first paying AI client.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginBottom: "20px" }}>
          <Link href="/signup" style={{ background: "#00AAFF", color: "#000", fontWeight: "800", fontSize: "16px", padding: "16px 36px", borderRadius: "10px", textDecoration: "none", display: "inline-block" }}>
            Start your 14-day sprint (free) →
          </Link>
        </div>

        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px" }}>
          No experience needed · No tech setup · Cancel anytime
        </p>
      </section>

      {/* SOCIAL PROOF BAR */}
      <section style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", padding: "24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", justifyContent: "center", gap: "48px", flexWrap: "wrap" }}>
          {[
            { value: "14 days", label: "avg to first client" },
            { value: "$0", label: "to start" },
            { value: "1,300+", label: "niches to target" },
            { value: "24–72hrs", label: "first replies" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <p style={{ color: "white", fontWeight: "800", fontSize: "22px", margin: "0 0 2px" }}>{stat.value}</p>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", margin: 0 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: "80px 24px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <p style={{ color: "#00AAFF", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>
            THE SYSTEM
          </p>
          <h2 style={{ color: "white", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "800", margin: "0 0 12px" }}>
            Five moves. Fourteen days. First client.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>
            Every step is guided. Every word is written for you.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { num: "01", title: "Pick your niche", desc: "Browse 1,300+ business types. The system shows you which ones have the highest revenue potential for AI services." },
            { num: "02", title: "Your offer is written for you", desc: "Claude builds a niche-specific AI service offer in under 60 seconds. Pricing model, guarantee, and outcome statement included." },
            { num: "03", title: "Send 20 messages — already written", desc: "LinkedIn, Instagram, and email outreach written using proven sales frameworks. Every message invites prospects to a demo — not a sales call." },
            { num: "04", title: "Run the demo live on a call", desc: "Show prospects their own business being handled by AI in real time. Present mode hides the product — they only see the demo." },
            { num: "05", title: "Send a proposal and get paid", desc: "Claude writes the proposal from your call notes. Performance-based pricing means the client has no reason to say no." },
          ].map(step => (
            <div key={step.num} style={{ display: "flex", gap: "20px", padding: "24px", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "0.5px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flexShrink: 0, width: "40px", height: "40px", borderRadius: "8px", background: "rgba(0,170,255,0.1)", border: "0.5px solid rgba(0,170,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#00AAFF", fontWeight: "800", fontSize: "13px" }}>{step.num}</span>
              </div>
              <div>
                <p style={{ color: "white", fontWeight: "700", fontSize: "16px", margin: "0 0 4px" }}>{step.title}</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT IS INSIDE */}
      <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.01)", borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <p style={{ color: "#00AAFF", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>THE TOOLS</p>
            <h2 style={{ color: "white", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "800", margin: 0 }}>
              Everything you need. Nothing you do not.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {[
              { title: "AI Audit Tool", money: "Turn a simple form into a $500+ paid audit", desc: "Send prospects a branded audit link. They fill it in. Claude analyses their responses and generates a professional report you sell." },
              { title: "Dead Lead Revival", money: "Turn old leads into new revenue for your client", desc: "Connect GoHighLevel and watch AI re-engage dormant contacts automatically. Performance-based — your client only pays on results." },
              { title: "Coffee Date Demo", money: "Close on conviction, not pitch", desc: "Run a live AI demo on any Google Meet call. Presentation mode hides the product. The prospect only sees AI handling their business." },
              { title: "Outreach Engine", money: "20 messages written in 30 seconds", desc: "Claude writes channel-specific outreach using tactical empathy and the 3C framework. LinkedIn, Instagram, and email — ready to send." },
              { title: "Quiz Funnel", money: "Turn cold traffic into warm audit leads", desc: "Share a branded quiz link. Prospects get an AI readiness score. The quiz feeds directly into your audit pipeline automatically." },
              { title: "Mission Control", money: "Know exactly what to do every day", desc: "Claude generates your daily mission based on your pipeline, your pace, and your 14-day sprint. No guessing. Just execute." },
            ].map(tool => (
              <div key={tool.title} style={{ background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "24px" }}>
                <p style={{ color: "white", fontWeight: "700", fontSize: "16px", margin: "0 0 6px" }}>{tool.title}</p>
                <p style={{ color: "#00AAFF", fontSize: "13px", fontWeight: "600", margin: "0 0 10px" }}>{tool.money}</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT IS FOR */}
      <section style={{ padding: "80px 24px", maxWidth: "760px", margin: "0 auto", textAlign: "center" }}>
        <p style={{ color: "#00AAFF", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>
          WHO THIS IS FOR
        </p>
        <h2 style={{ color: "white", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "800", margin: "0 0 16px" }}>
          You do not need to be technical.
          <br />You need to be decisive.
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "17px", lineHeight: "1.7", margin: "0 0 40px" }}>
          If you have ever said &quot;I want to make money from AI but I do not know where to start&quot; — this is where you start. Aether Revive is used by people who are done watching and ready to earn.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
          {[
            "Beginners landing their first AI client",
            "Agency owners adding AI services",
            "Freelancers building recurring income",
          ].map(type => (
            <div key={type} style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "10px 18px", color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
              {type}
            </div>
          ))}
        </div>
      </section>

      {/* TIMELINE */}
      <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.01)", borderTop: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <p style={{ color: "#00AAFF", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>WHAT TO EXPECT</p>
            <h2 style={{ color: "white", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "800", margin: "0 0 8px" }}>
              A real timeline.
            </h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>Not a vague promise.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { day: "Day 1", title: "Offer ready. Messages ready. You can start today.", desc: "Niche selected, offer generated, 20 outreach messages written. Everything is done for you." },
              { day: "Day 3", title: "Replies start coming in.", desc: "The reply assistant handles the conversation. Your only job is to book the demo call." },
              { day: "Day 7", title: "First demo call booked.", desc: "You run the Coffee Date Demo live. The prospect sees AI handling their business in real time." },
              { day: "Day 14", title: "First proposal sent. First client in motion.", desc: "Claude writes the proposal from your call notes. Performance-based pricing removes the final objection." },
            ].map((item, i) => (
              <div key={item.day} style={{ display: "flex", gap: "20px", paddingBottom: "32px" }}>
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(0,170,255,0.1)", border: "1px solid rgba(0,170,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00AAFF" }} />
                  </div>
                  {i < 3 && (
                    <div style={{ width: "1px", flex: 1, background: "rgba(0,170,255,0.15)", marginTop: "6px", minHeight: "32px" }} />
                  )}
                </div>
                <div style={{ paddingTop: "6px" }}>
                  <p style={{ color: "#00AAFF", fontSize: "12px", fontWeight: "700", margin: "0 0 4px", letterSpacing: "0.5px" }}>{item.day}</p>
                  <p style={{ color: "white", fontWeight: "700", fontSize: "16px", margin: "0 0 4px" }}>{item.title}</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", lineHeight: "1.6", margin: 0 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 24px", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <p style={{ color: "#00AAFF", fontSize: "11px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px" }}>PRICING</p>
          <h2 style={{ color: "white", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: "800", margin: "0 0 12px" }}>
            Start your first AI client sprint
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "16px", margin: 0 }}>
            14 days completely free. No credit card required to start.
          </p>
        </div>
        <PricingSection />
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: "80px 24px", textAlign: "center", borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: "560px", margin: "0 auto" }}>
          <h2 style={{ color: "white", fontSize: "clamp(32px, 5vw, 48px)", fontWeight: "900", margin: "0 0 16px", lineHeight: "1.1" }}>
            Stop watching.
            <br />Start getting clients.
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "17px", margin: "0 0 32px", lineHeight: "1.6" }}>
            The system is built. You just need to use it.
          </p>
          <Link
            href="/signup"
            style={{ display: "inline-block", background: "#00AAFF", color: "#000", fontWeight: "800", fontSize: "18px", padding: "18px 48px", borderRadius: "12px", textDecoration: "none" }}
          >
            Start your sprint today →
          </Link>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", marginTop: "16px" }}>
            No experience needed · No tech setup · Cancel anytime
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "24px", borderTop: "0.5px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "13px", margin: 0 }}>
          © 2026 Aether Revive. All rights reserved.
        </p>
      </footer>

    </div>
  )
}
