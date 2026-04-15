import Link from 'next/link'
import Image from 'next/image'
import { FileText, Clock, MessageCircle, Check, Play } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080B0F] text-white">
      {/* SECTION 1 — NAV */}
      <nav className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Image 
            src="/images/aether-revive-logo.png" 
            alt="Aether Revive" 
            width={100} 
            height={40}
            className="opacity-90"
          />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-colors hover:bg-white/5"
              style={{ border: '0.5px solid rgba(255,255,255,0.06)' }}
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
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">
        {/* Subtle radial blue glow */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, #00AAFF 0%, transparent 70%)',
          }}
        />
        
        <div className="relative max-w-[900px] mx-auto px-6 text-center">
          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <span 
              className="px-4 py-1.5 text-sm rounded-full"
              style={{ 
                border: '0.5px solid rgba(255,255,255,0.12)', 
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.5)'
              }}
            >
              AI Client Acquisition System
            </span>
            <span 
              className="flex items-center gap-2 px-4 py-1.5 text-sm rounded-full text-[#00AAFF]"
              style={{ 
                border: '0.5px solid rgba(0,170,255,0.25)', 
                background: 'rgba(0,170,255,0.08)'
              }}
            >
              <span className="w-2 h-2 rounded-full bg-[#00AAFF]" />
              First replies in 24–72 hours
            </span>
          </div>

          {/* Headline */}
          <h1 
            className="text-[38px] md:text-[64px] lg:text-[72px] mb-6 text-balance"
            style={{ 
              fontFamily: 'var(--font-manrope)',
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: '-0.02em'
            }}
          >
            Get your first AI client{' '}
            <span className="text-[#00AAFF]">in 14 days</span> — proven system
          </h1>

          {/* Subheadline */}
          <p 
            className="text-base md:text-lg max-w-[700px] mx-auto mb-5 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            Turn old leads into deals, run AI audits, and close clients — all inside one workspace built for agency growth.
          </p>

          {/* Social proof */}
          <p className="text-[13px] mb-10" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Used by 200+ people building their first AI income
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
            <Link
              href="/signup"
              className="px-8 py-3.5 text-sm font-medium text-black bg-[#00AAFF] rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
            >
              Start free
            </Link>
            <button 
              className="flex items-center gap-2 px-6 py-3.5 text-sm font-medium text-white rounded-lg hover:bg-white/5 transition-colors"
              style={{ border: '0.5px solid rgba(255,255,255,0.15)' }}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
                <Play className="w-2.5 h-2.5 fill-white" />
              </span>
              Watch 90-sec demo
            </button>
          </div>

          {/* Microtrust */}
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            No experience needed · No tech setup required · Cancel anytime
          </p>
        </div>
      </section>

      {/* SECTION 3 — STAT BAR */}
      <section style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', borderBottom: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div className="max-w-[1000px] mx-auto px-6 md:px-12 py-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0">
            <div className="text-center md:flex-1">
              <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }} className="text-2xl text-white">200+</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>users</div>
            </div>
            <div className="hidden md:block w-px h-10" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="text-center md:flex-1">
              <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }} className="text-2xl text-white">£0</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>to start</div>
            </div>
            <div className="hidden md:block w-px h-10" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="text-center md:flex-1">
              <div style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }} className="text-2xl text-white">14 days</div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>avg to first client</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-[11px] font-medium tracking-[1.5px] text-center mb-12" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                  <div 
                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center"
                    style={{ border: '0.5px solid rgba(0,170,255,0.3)', background: 'rgba(0,170,255,0.1)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }} className="text-xs text-[#00AAFF]">{step.num}</span>
                  </div>
                  <span className="text-xs text-center whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.45)' }}>{step.label}</span>
                </div>
                {i < 4 && (
                  <span className="hidden md:block mx-2" style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — FEATURES */}
      <section className="py-20 md:py-28">
        <div className="max-w-[1200px] mx-auto px-6">
          <p className="text-[11px] font-medium tracking-[1.5px] text-center mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {"WHAT'S INSIDE"}
          </p>
          <h2 
            className="text-[26px] md:text-[28px] text-white text-center mb-14"
            style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
          >
            Everything you need to get and close clients
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div 
              className="rounded-xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <div 
                className="w-[34px] h-[34px] rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,170,255,0.1)', border: '0.5px solid rgba(0,170,255,0.2)' }}
              >
                <FileText className="w-4 h-4 text-[#00AAFF]" />
              </div>
              <h3 
                className="text-[15px] text-white mb-2"
                style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
              >
                Close clients with AI audits
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Show businesses where they're losing money — and position your service as the fix.
              </p>
            </div>

            {/* Card 2 */}
            <div 
              className="rounded-xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <div 
                className="w-[34px] h-[34px] rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,170,255,0.1)', border: '0.5px solid rgba(0,170,255,0.2)' }}
              >
                <Clock className="w-4 h-4 text-[#00AAFF]" />
              </div>
              <h3 
                className="text-[15px] text-white mb-2"
                style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
              >
                Turn old leads into new deals
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Connect your CRM and revive cold contacts using AI-powered messaging sequences.
              </p>
            </div>

            {/* Card 3 */}
            <div 
              className="rounded-xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.08)' }}
            >
              <div 
                className="w-[34px] h-[34px] rounded-lg flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,170,255,0.1)', border: '0.5px solid rgba(0,170,255,0.2)' }}
              >
                <MessageCircle className="w-4 h-4 text-[#00AAFF]" />
              </div>
              <h3 
                className="text-[15px] text-white mb-2"
                style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
              >
                Test before you sell
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Simulate conversations in the demo sandbox and refine your offer before going live.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — TWO-COLUMN: WHO + EXPECT */}
      <section className="py-20 md:py-28" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            {/* Left column — Who this is for */}
            <div>
              <p className="text-[11px] font-medium tracking-[1.5px] mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                WHO THIS IS FOR
              </p>
              <h2 
                className="text-[22px] text-white mb-2"
                style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
              >
                Built for people ready to earn from AI
              </h2>
              <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
                No technical background needed. Just follow the system.
              </p>
              
              <div className="space-y-4">
                {[
                  'Beginners landing their first AI client',
                  'Agency owners adding AI services',
                  'Freelancers building recurring revenue',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div 
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(0,170,255,0.15)' }}
                    >
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-white">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column — What to expect */}
            <div>
              <p className="text-[11px] font-medium tracking-[1.5px] mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                WHAT YOU CAN EXPECT
              </p>
              <h2 
                className="text-[22px] text-white mb-2"
                style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
              >
                A real timeline, not a vague promise
              </h2>
              <p className="text-[13px] mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
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
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }} className="text-[11px] text-[#00AAFF]">{milestone.time}</span>
                    <span className="text-sm text-white">{milestone.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — CLOSING CTA */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        {/* Subtle radial blue glow at bottom */}
        <div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] opacity-12 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, #00AAFF 0%, transparent 70%)',
          }}
        />
        
        <div className="relative max-w-[900px] mx-auto px-6 text-center">
          <h2 
            className="text-[28px] md:text-[36px] text-white mb-4"
            style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800 }}
          >
            Start your AI service today
          </h2>
          <p className="text-[15px] mb-10 max-w-[640px] mx-auto" style={{ color: 'rgba(255,255,255,0.45)' }}>
            No experience needed. Just follow the system.
          </p>
          
          <Link
            href="/signup"
            className="inline-block px-10 py-3.5 text-sm font-medium text-black bg-[#00AAFF] rounded-lg hover:bg-[#00AAFF]/90 transition-colors"
          >
            Get started free
          </Link>
          
          <p className="text-[11px] mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
            No credit card required · No tech setup required · Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            © 2026 Aether Revive. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
