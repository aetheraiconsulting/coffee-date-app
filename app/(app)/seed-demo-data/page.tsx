"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function SeedDemoDataPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message])
  }

  const seedData = async () => {
    setIsRunning(true)
    setLogs([])

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        addLog("✗ Not authenticated")
        setIsRunning(false)
        return
      }
      const userId = user.id

      // Step 1 — Create active offer
      addLog("Creating active offer...")
      
      // First deactivate any existing active offers
      await supabase
        .from("offers")
        .update({ is_active: false })
        .eq("user_id", userId)

      const { data: offer, error: offerError } = await supabase
        .from("offers")
        .insert({
          user_id: userId,
          service_name: "AI Dormant Lead Revival System",
          niche: "Dental Practices",
          outcome_statement: "Reactivate 15-20% of dormant patients within 30 days using AI-powered SMS sequences",
          pricing_model: "50_profit_share",
          price_point: "50% of net revenue recovered",
          guarantee: "You only pay when we deliver results",
          is_active: true,
          confidence_score: "strong",
          confidence_reason: "High dormant lead volume and proven SMS reactivation rates in dental niche",
        })
        .select()
        .single()

      if (offerError) {
        addLog(`✗ Failed to create offer: ${offerError.message}`)
        setIsRunning(false)
        return
      }

      // Update profiles.offer_id
      await supabase
        .from("profiles")
        .update({ offer_id: offer.id })
        .eq("id", userId)

      addLog("✓ Active offer created — AI Dormant Lead Revival System")

      // Step 2 — Create 20 outreach messages
      addLog("Creating outreach messages...")
      
      const channels = ["linkedin", "linkedin", "linkedin", "instagram", "email"]
      const statuses = ["sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "sent", "draft", "draft", "draft", "draft", "draft", "draft"]

      const messages = [
        "It sounds like keeping in touch with patients who haven't booked in over 12 months is one of those things that always gets pushed back. Most dental practices I speak to have between 2,000 and 5,000 dormant patients sitting in their system right now. I've built something specific for practices like yours — would it be crazy to spend 10 minutes seeing it?",
        "It sounds like your front desk team is already stretched across bookings, reminders, and admin. Following up with patients who went quiet 6-18 months ago probably never makes it to the top of the list. I've built an AI system specifically for dental practices to handle that automatically. Would it be worth a 10-minute screen share to see how it works?",
        "Most dental practices I work with tell me the same thing — they know they have patients who haven't been back in over a year, but there's no system to reach them at scale. I've built something that handles that automatically using AI. Would it be crazy to see it working on a practice like yours?",
        "It sounds like growing a patient base right now means spending more on ads — when the real opportunity is probably already in your existing database. I've built an AI system that reactivates dormant dental patients automatically. Worth a 10-minute demo?",
        "Running a dental practice means every hour counts — and chasing up patients who haven't booked in 12 months probably isn't how you want to spend yours. I've built an AI system that does exactly that, automatically. Would it be worth 10 minutes to see it in action?",
        "It sounds like patient retention is one of those things that gets reactive rather than proactive — you notice when patients leave, but there's rarely a system to bring them back. I've built something specifically for dental practices that handles reactivation at scale. Would it be crazy to take 10 minutes to see it?",
        "Most dental practices have thousands of patients who came in once or twice and then went quiet. That's not lost revenue — it's dormant revenue. I've built an AI system that reactivates those patients automatically using SMS. Worth a quick demo call?",
        "It sounds like your biggest untapped opportunity might already be sitting in your patient database. I've built an AI dead lead revival system specifically for dental practices — would it be worth 10 minutes to see what it could recover for a practice your size?",
        "Following up with patients who haven't booked in 12-18 months is almost impossible to do manually at scale. I've built an AI system that handles it automatically for dental practices. Would it be crazy to spend 10 minutes seeing the results?",
        "It sounds like the gap between new patient acquisition costs and dormant patient reactivation is something most practices haven't fully explored. I've built something that closes that gap using AI. Worth a 10-minute screen share?",
        "Most practices I speak to spend thousands on Google Ads to acquire new patients — when reactivating existing dormant ones costs a fraction of that. I've built an AI system specifically for dental practices. Would it be worth 10 minutes to see it working?",
        "It sounds like patient communication beyond appointment reminders is one of those things that falls through the cracks. I've built an AI system that handles dormant patient reactivation automatically. Would it be crazy to see it in action?",
        "Running a dental practice means the focus is always on the chair — not on the 3,000 patients who haven't booked in over a year. I've built an AI system that handles that reactivation automatically. Worth a quick 10-minute demo?",
        "It sounds like the patients most likely to rebook are the ones you've already built trust with — they just need the right message at the right time. I've built an AI system that handles exactly that for dental practices. Would it be worth 10 minutes to see it?",
        "Most dental practices I speak to have between 2,000 and 8,000 dormant patients. Reactivating even 5% of those at an average treatment value of $400 is significant revenue with no ad spend. I've built an AI system that makes this automatic. Worth a 10-minute call?",
        "It sounds like your team is too busy delivering great patient care to systematically follow up with everyone who went quiet. That's exactly the problem I built this for. Would it be crazy to see how AI handles it automatically?",
        "Most practices treat patient reactivation as a manual task — which means it rarely happens consistently. I've built an AI system that makes it automatic for dental practices. Worth 10 minutes to see the results?",
        "It sounds like there's a gap between the patients you've served and the ones actively booking — and that gap represents recoverable revenue. I've built an AI system specifically for dental practices to close it. Would it be worth a quick demo?",
        "Running a dental practice means patient relationships are everything — but maintaining contact with thousands of dormant patients manually is impossible. I've built an AI system that handles it. Worth 10 minutes?",
        "It sounds like your existing patient database might be your biggest untapped asset right now. I've built an AI dead lead revival system for dental practices. Would it be crazy to spend 10 minutes seeing what it could recover?"
      ]

      const messagesToInsert = messages.map((text, i) => ({
        user_id: userId,
        offer_id: offer.id,
        message_text: text,
        channel: channels[i % channels.length],
        status: statuses[i],
        note: statuses[i] === "sent" ? `Sent to prospect ${i + 1}` : null,
        sent_at: statuses[i] === "sent" ? new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toISOString() : null,
      }))

      const { error: messagesError } = await supabase.from("outreach_messages").insert(messagesToInsert)
      if (messagesError) {
        addLog(`✗ Failed to create messages: ${messagesError.message}`)
        setIsRunning(false)
        return
      }
      addLog("✓ 20 outreach messages created (14 sent, 6 draft)")

      // Step 3 — Create 3 reply threads
      addLog("Creating reply threads...")
      
      const { data: sentMessages } = await supabase
        .from("outreach_messages")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "sent")
        .limit(3)

      const replies = [
        {
          prospect_reply: "Hi, this is interesting actually. We do have a lot of patients we haven't heard from in a while. How does it work exactly?",
          suggested_response: "It sounds like you've already identified the opportunity — that's a good sign. The system sends personalised AI-powered messages to dormant patients at the right time, automatically. Rather than explain it, would it be crazy to spend 10 minutes seeing it working on a practice like yours on a quick screen share?",
          response_goal: "Move prospect toward booking a demo call",
          response_sent: true,
        },
        {
          prospect_reply: "We tried something similar before and it didn't really work for us",
          suggested_response: "That makes complete sense — most tools in this space are generic. What I've built is specifically trained on dental patient conversations and only books back patients who are genuinely interested. Would it be worth 10 minutes to see how it's different in practice?",
          response_goal: "Handle objection and redirect toward demo",
          response_sent: false,
        },
        {
          prospect_reply: "Can you send me more information?",
          suggested_response: "I could send something over — but honestly the system is something you need to see working to appreciate it. It takes 10 minutes on a screen share and you'd see it handling a real dental practice scenario live. Would it be crazy to grab a slot this week?",
          response_goal: "Redirect from information request toward demo booking",
          response_sent: false,
        },
      ]

      if (sentMessages && sentMessages.length >= 3) {
        for (let i = 0; i < replies.length; i++) {
          await supabase.from("reply_threads").insert({
            user_id: userId,
            outreach_message_id: sentMessages[i].id,
            ...replies[i],
          })

          // Update outreach message status to replied
          await supabase
            .from("outreach_messages")
            .update({ status: "replied" })
            .eq("id", sentMessages[i].id)
        }
      }
      addLog("✓ 3 reply threads created")

      // Step 4 — Create 1 completed call script
      addLog("Creating call script...")
      
      const { error: callScriptError } = await supabase.from("call_scripts").insert({
        user_id: userId,
        offer_id: offer.id,
        opening: "Thank you for taking the time — I know you're busy. I want to keep this to 10 minutes. I'm going to show you the system working on a dental practice scenario and then we can talk about whether it makes sense for yours.",
        qualification_questions: "How many active patients do you have in your system? How many would you estimate haven't booked in the last 12 months? Do you currently have any system for following up with dormant patients?",
        objection_responses: "If they say they tried something similar: Most tools are generic — this is trained specifically on dental patient conversations. If they ask about cost: Performance-based — you only pay when patients rebook. No upfront cost.",
        close_ask: "Based on what you've seen today, does this look like something worth running on your practice for 30 days? The only cost is a share of revenue we actually recover for you.",
        call_completed: true,
        call_completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        call_notes: "Practice has approximately 4,200 patients. Estimates 1,800 haven't booked in over 12 months. Currently no reactivation system. Very interested — asked about timeline to get started. Follow up with proposal.",
      })

      if (callScriptError) {
        addLog(`✗ Failed to create call script: ${callScriptError.message}`)
      } else {
        addLog("✓ 1 call script created (completed)")
      }

      // Step 5 — Create 1 proposal
      addLog("Creating proposal...")
      
      const { error: proposalError } = await supabase.from("proposals").insert({
        user_id: userId,
        offer_id: offer.id,
        prospect_name: "Dr Sarah Mitchell",
        prospect_business: "Mitchell Family Dental",
        problem_summary: "Mitchell Family Dental has approximately 1,800 dormant patients who have not booked an appointment in over 12 months. With an average treatment value of $380, this represents over $680,000 in recoverable revenue sitting untouched in their existing patient database.",
        solution_summary: "We deploy an AI-powered patient reactivation system that sends personalised SMS sequences to dormant patients at optimal times. The system identifies patients most likely to rebook, personalises the outreach based on their history, and handles responses automatically until an appointment is booked.",
        deliverables: "AI SMS reactivation sequences deployed within 48 hours. Personalised messaging for up to 1,800 dormant patients. Automated response handling and appointment prompting. Monthly reporting on reactivated patients and revenue recovered. Ongoing optimisation based on response data.",
        investment: "50% of net revenue recovered from reactivated patients. Zero upfront cost. Zero retainer. You only pay when patients rebook and pay for treatment.",
        guarantee: "If we do not reactivate a minimum of 15 patients in the first 30 days, we continue working at no charge until we do.",
        next_step: "Sign the agreement and provide CRM access. We will have the system live within 48 hours.",
        confidence_score: "strong",
        confidence_reason: "Large dormant patient database, clear revenue opportunity, performance-based model removes risk objection, prospect expressed strong interest on call.",
        sent: true,
        sent_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        deal_status: "pending",
      })

      if (proposalError) {
        addLog(`✗ Failed to create proposal: ${proposalError.message}`)
      } else {
        addLog("✓ 1 proposal created (sent to Dr Sarah Mitchell)")
      }

      // Step 6 — Update outreach table
      addLog("Updating outreach table...")
      
      const { error: outreachError } = await supabase
        .from("outreach")
        .upsert({
          user_id: userId,
          started: true,
          messages_generated: true,
          first_sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          total_sent: 14,
        }, { onConflict: "user_id" })

      if (outreachError) {
        addLog(`✗ Failed to update outreach: ${outreachError.message}`)
      } else {
        addLog("✓ Outreach table updated")
      }

      // Step 7 — Set sprint start date to 7 days ago
      addLog("Setting sprint start date...")
      
      const sprintStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { error: sprintError } = await supabase
        .from("profiles")
        .update({ sprint_start_date: sprintStartDate })
        .eq("id", userId)

      if (sprintError) {
        addLog(`✗ Sprint start date failed: ${sprintError.message}`)
      } else {
        addLog(`✓ Sprint start date set to 7 days ago`)
      }

      // Step 8 — Update niche_user_state
      addLog("Updating niche user state...")
      
      const { data: dentalNiche } = await supabase
        .from("niches")
        .select("id")
        .ilike("niche_name", "%dental%")
        .limit(1)
        .maybeSingle()

      if (dentalNiche) {
        await supabase
          .from("niche_user_state")
          .upsert({
            user_id: userId,
            niche_id: dentalNiche.id,
            stage: "demo",
            outreach_generated: true,
            offer_id: offer.id,
            outreach_start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            outreach_messages_sent: 14,
            coffee_date_completed: true,
            coffee_date_completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            status: "Coffee Date Demo",
          }, { onConflict: "user_id,niche_id" })

        addLog("✓ Niche user state updated for Dental Practices")
      } else {
        addLog("⚠ Dental Practices niche not found — skipped niche_user_state")
      }

      addLog("")
      addLog("✓ Demo data ready — go to Dashboard")
      setIsComplete(true)

    } catch (error) {
      addLog(`✗ Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    setIsRunning(false)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080B0F", padding: "40px" }}>
      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Warning banner */}
        <div style={{ 
          background: "rgba(239, 68, 68, 0.1)", 
          border: "1px solid rgba(239, 68, 68, 0.3)", 
          borderRadius: "8px", 
          padding: "16px", 
          marginBottom: "32px",
          color: "#ef4444",
          fontWeight: "600",
          fontSize: "14px"
        }}>
          ⚠️ DEMO DATA ONLY — Delete this page before launch
        </div>

        <h1 style={{ color: "white", fontSize: "24px", fontWeight: "700", marginBottom: "8px" }}>
          Seed Demo Data
        </h1>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", marginBottom: "32px" }}>
          Populates your account with realistic pipeline data for day 7 of a sprint. For screen recording only.
        </p>

        {!isRunning && !isComplete && (
          <button
            onClick={seedData}
            style={{
              background: "#00AAFF",
              color: "#000",
              fontWeight: "700",
              fontSize: "14px",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              marginBottom: "24px"
            }}
          >
            Seed demo data
          </button>
        )}

        {isRunning && (
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", marginBottom: "24px" }}>
            Running...
          </div>
        )}

        {/* Status log */}
        {logs.length > 0 && (
          <div style={{ 
            background: "rgba(255,255,255,0.03)", 
            border: "1px solid rgba(255,255,255,0.1)", 
            borderRadius: "8px", 
            padding: "20px",
            marginBottom: "24px"
          }}>
            <div style={{ fontFamily: "monospace", fontSize: "13px", lineHeight: "2" }}>
              {logs.map((log, i) => (
                <div key={i} style={{ color: log.includes("✓") ? "#22c55e" : log.includes("✗") ? "#ef4444" : "rgba(255,255,255,0.6)" }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {isComplete && (
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              background: "#22c55e",
              color: "#000",
              fontWeight: "700",
              fontSize: "14px",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer"
            }}
          >
            Go to Dashboard
          </button>
        )}
      </div>
    </div>
  )
}
