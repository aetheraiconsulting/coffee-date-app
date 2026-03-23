import Link from 'next/link'
import { FileText, Clock, MessageCircle, Check, Play } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080B0F] text-white font-sans">
      {/* SECTION 1 — NAV */}
      <nav className="border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-heading font-extrabold text-lg tracking-tight">
            AETHER <span className="text-[#00AAFF]">AI</span> LAB
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-sm font-medium text-white border border-white rounded-lg hover:bg-white/5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 text-sm font-medium text-black bg-[#00AAFF] rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* SECTION 2 — HERO */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Subtle radial blue glow */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, #00AAFF 0%, transparent 70%)',
          }}
        />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <span className="px-4 py-1.5 text-sm rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] text-[rgba(255,255,255,0.5)]">
              AI Client Acquisition System
            </span>
            <span className="flex items-center gap-2 px-4 py-1.5 text-sm rounded-full border border-[rgba(0,170,255,0.25)] bg-[rgba(0,170,255,0.08)] text-[#00AAFF]">
              <span className="w-2 h-2 rounded-full bg-[#00AAFF]" />
              First replies in 24–72 hours
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-heading font-extrabold text-4xl md:text-[52px] leading-[1.08] tracking-[-1.5px] mb-6 text-balance">
            Land your first AI client{' '}
            <span className="text-[#00AAFF]">in 14 days.</span>
          </h1>

          {/* Subheadline */}
          <p className="font-light text-lg text-[rgba(255,255,255,0.5)] max-w-[480px] mx-auto mb-4">
            Send outreach, run audits, close clients. Everything in one place.
          </p>

          {/* Social proof */}
          <p className="text-[13px] text-[rgba(255,255,255,0.3)] mb-8">
            Used by 200+ people building their first AI income
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <Link
              href="/signup"
              className="px-8 py-3.5 text-sm font-medium text-black bg-[#00AAFF] rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
            >
              Get started
            </Link>
            <button className="flex items-center gap-2 px-6 py-3.5 text-sm font-medium text-white border border-[rgba(255,255,255,0.15)] rounded-lg hover:bg-white/5 transition-colors">
              <span className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center">
                <Play className="w-2.5 h-2.5 fill-white" />
              </span>
              Watch 90-sec demo
            </button>
          </div>

          {/* Microtrust */}
          <p className="text-xs text-[rgba(255,255,255,0.2)]">
            Free to start · No tech setup · Cancel anytime
          </p>
        </div>
      </section>

      {/* SECTION 3 — STAT BAR */}
      <section className="border-y border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0">
            <div className="text-center md:flex-1">
              <div className="font-heading font-bold text-2xl text-white">200+</div>
              <div className="text-sm text-[rgba(255,255,255,0.45)]">users</div>
            </div>
            <div className="hidden md:block w-px h-10 bg-[rgba(255,255,255,0.08)]" />
            <div className="text-center md:flex-1">
              <div className="font-heading font-bold text-2xl text-white">£0</div>
              <div className="text-sm text-[rgba(255,255,255,0.45)]">to start</div>
            </div>
            <div className="hidden md:block w-px h-10 bg-[rgba(255,255,255,0.08)]" />
            <div className="text-center md:flex-1">
              <div className="font-heading font-bold text-2xl text-white">14 days</div>
              <div className="text-sm text-[rgba(255,255,255,0.45)]">avg to first client</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] font-medium tracking-[1.5px] text-[rgba(255,255,255,0.45)] text-center mb-10">
            HOW IT WORKS
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
            {[
              { num: 1, label: 'Find an opportunity' },
              { num: 2, label: 'Contact prospects' },
              { num: 3, label: 'Run an AI audit' },
              { num: 4, label: 'Close the deal' },
              { num: 5, label: 'Deliver with AI' },
            ].map((step, i) => (
              <div key={step.num} className="flex items-center gap-2 md:gap-2">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-[30px] h-[30px] rounded-full border border-[rgba(0,170,255,0.3)] bg-[rgba(0,170,255,0.1)] flex items-center justify-center">
                    <span className="text-xs font-heading font-bold text-[#00AAFF]">{step.num}</span>
                  </div>
                  <span className="text-xs text-[rgba(255,255,255,0.45)] text-center whitespace-nowrap">{step.label}</span>
                </div>
                {i < 4 && (
                  <span className="hidden md:block text-[rgba(255,255,255,0.2)] mx-2">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — FEATURES */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[11px] font-medium tracking-[1.5px] text-[rgba(255,255,255,0.45)] text-center mb-3">
            {"WHAT'S INSIDE"}
          </p>
          <h2 className="font-heading font-bold text-[28px] text-white text-center mb-12">
            Everything you need to get and close clients
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
              <div className="w-[34px] h-[34px] rounded-lg bg-[rgba(0,170,255,0.1)] border border-[rgba(0,170,255,0.2)] flex items-center justify-center mb-4">
                <FileText className="w-4 h-4 text-[#00AAFF]" />
              </div>
              <h3 className="font-heading font-bold text-[15px] text-white mb-2">
                Close clients with AI audits
              </h3>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)] leading-relaxed">
                Show businesses where they're losing money — and position your service as the fix.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
              <div className="w-[34px] h-[34px] rounded-lg bg-[rgba(0,170,255,0.1)] border border-[rgba(0,170,255,0.2)] flex items-center justify-center mb-4">
                <Clock className="w-4 h-4 text-[#00AAFF]" />
              </div>
              <h3 className="font-heading font-bold text-[15px] text-white mb-2">
                Turn old leads into new deals
              </h3>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)] leading-relaxed">
                Connect your CRM and revive cold contacts using AI-powered messaging sequences.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
              <div className="w-[34px] h-[34px] rounded-lg bg-[rgba(0,170,255,0.1)] border border-[rgba(0,170,255,0.2)] flex items-center justify-center mb-4">
                <MessageCircle className="w-4 h-4 text-[#00AAFF]" />
              </div>
              <h3 className="font-heading font-bold text-[15px] text-white mb-2">
                Test before you sell
              </h3>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)] leading-relaxed">
                Simulate conversations in the demo sandbox and refine your offer before going live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — TWO-COLUMN: WHO + EXPECT */}
      <section className="border-t border-[rgba(255,255,255,0.06)] py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            {/* Left column — Who this is for */}
            <div>
              <p className="text-[11px] font-medium tracking-[1.5px] text-[rgba(255,255,255,0.45)] mb-3">
                WHO THIS IS FOR
              </p>
              <h2 className="font-heading font-bold text-[22px] text-white mb-2">
                Built for people ready to earn from AI
              </h2>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-6">
                No technical background needed. Just follow the system.
              </p>
              
              <div className="space-y-4">
                {[
                  'Beginners landing their first AI client',
                  'Agency owners adding AI services',
                  'Freelancers building recurring revenue',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[rgba(0,170,255,0.15)] flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-white">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — What to expect */}
            <div>
              <p className="text-[11px] font-medium tracking-[1.5px] text-[rgba(255,255,255,0.45)] mb-3">
                WHAT YOU CAN EXPECT
              </p>
              <h2 className="font-heading font-bold text-[22px] text-white mb-2">
                A real timeline, not a vague promise
              </h2>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-6">
                Most users following the system report these milestones.
              </p>
              
              <div className="space-y-3">
                {[
                  { time: '24–72 hrs', text: 'First replies from prospects' },
                  { time: '7–14 days', text: 'First client conversation booked' },
                  { time: '30 days', text: 'First deal closed — no tech overwhelm' },
                ].map((milestone) => (
                  <div 
                    key={milestone.time} 
                    className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-3 flex items-center gap-3"
                  >
                    <span className="font-heading font-bold text-[11px] text-[#00AAFF]">{milestone.time}</span>
                    <span className="text-sm text-white">{milestone.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — CLOSING CTA */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        {/* Subtle radial blue glow at bottom */}
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, #00AAFF 0%, transparent 70%)',
          }}
        />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white mb-4">
            Start your AI service today
          </h2>
          <p className="text-[15px] text-[rgba(255,255,255,0.45)] mb-8">
            No experience needed. Just follow the system.
          </p>
          
          <Link
            href="/signup"
            className="inline-block px-10 py-3.5 text-sm font-medium text-black bg-[#00AAFF] rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
          >
            Get started free
          </Link>
          
          <p className="text-[11px] text-[rgba(255,255,255,0.2)] mt-6">
            No credit card required · No tech setup required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(255,255,255,0.06)] py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs text-[rgba(255,255,255,0.3)]">
            © 2026 Aether AI Lab. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
