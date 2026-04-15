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

      // Step 1 — Set sprint to Day 10
      addLog("Step 1: Setting sprint to Day 10...")
      const sprintStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from("profiles")
        .update({ sprint_start_date: sprintStart })
        .eq("id", userId)
      addLog("✓ Sprint set to Day 10 of 14")

      // Step 2 — Create three niche-specific offers
      addLog("Step 2: Creating three niche-specific offers...")
      
      // Deactivate any existing offers
      await supabase.from("offers").update({ is_active: false }).eq("user_id", userId)

      const offersToInsert = [
        {
          user_id: userId,
          service_name: "AI Dormant Patient Revival System",
          niche: "Dental Practices",
          outcome_statement: "Reactivate 15-20% of dormant patients within 30 days using AI-powered SMS sequences",
          pricing_model: "50_profit_share",
          price_point: "50% of net revenue recovered",
          guarantee: "You only pay when we deliver results",
          is_active: true,
          confidence_score: "strong",
          confidence_reason: "High dormant lead volume and proven SMS reactivation rates in dental niche",
        },
        {
          user_id: userId,
          service_name: "AI Dead Lead Revival for HVAC",
          niche: "HVAC Companies",
          outcome_statement: "Re-engage past customers who requested quotes but never converted within 21 days",
          pricing_model: "50_profit_share",
          price_point: "50% of net revenue recovered",
          guarantee: "You only pay when we recover revenue",
          is_active: false,
          confidence_score: "strong",
          confidence_reason: "High average job value and large dormant quote database typical in HVAC",
        },
        {
          user_id: userId,
          service_name: "AI Lead Reactivation for Personal Injury",
          niche: "Personal Injury Attorneys",
          outcome_statement: "Re-engage cold leads who enquired but never signed within 14 days",
          pricing_model: "pay_per_lead",
          price_point: "$150 per reactivated qualified lead",
          guarantee: "You only pay for leads that respond and qualify",
          is_active: false,
          confidence_score: "strong",
          confidence_reason: "High case values make even small reactivation rates extremely profitable",
        },
      ]

      const { data: offers, error: offersError } = await supabase
        .from("offers")
        .insert(offersToInsert)
        .select()

      if (offersError || !offers) {
        addLog(`✗ Failed to create offers: ${offersError?.message}`)
        setIsRunning(false)
        return
      }

      const dentalOffer = offers.find(o => o.niche === "Dental Practices")!
      const hvacOffer = offers.find(o => o.niche === "HVAC Companies")!
      const injuryOffer = offers.find(o => o.niche === "Personal Injury Attorneys")!

      await supabase
        .from("profiles")
        .update({ offer_id: dentalOffer.id })
        .eq("id", userId)

      addLog("✓ Three niche-specific offers created")

      // Step 3 — Create outreach messages across all three niches
      addLog("Step 3: Creating outreach messages across 3 niches...")

      const dentalLinkedIn = [
        "It sounds like keeping in touch with patients who haven't booked in over 12 months is one of those things that always gets pushed back. Most dental practices I speak to have between 2,000 and 5,000 dormant patients sitting in their system right now. I've built something specific for practices like yours — would it be crazy to spend 10 minutes seeing it?",
        "Most dental practices I work with tell me the same thing — they know they have patients who haven't been back in over a year, but there's no system to reach them at scale. I've built something that handles that automatically using AI. Would it be worth a 10-minute demo?",
        "It sounds like your front desk team is already stretched across bookings, reminders, and admin. Following up with patients who went quiet 6-18 months ago probably never makes it to the top of the list. I've built an AI system specifically for dental practices to handle that automatically. Worth 10 minutes?",
        "Running a dental practice means the focus is always on the chair — not on the 3,000 patients who haven't booked in over a year. I've built an AI system that handles that reactivation automatically. Worth a quick 10-minute demo?",
        "Most practices treat patient reactivation as a manual task — which means it rarely happens consistently. I've built an AI system that makes it automatic for dental practices. Worth 10 minutes to see the results?",
      ]

      const hvacLinkedIn = [
        "It sounds like following up with every quote that went cold is impossible to do manually when your team is flat out on jobs. Most HVAC companies I speak to have hundreds of unconverted quotes sitting dormant right now. I've built an AI system that re-engages those leads automatically. Worth a 10-minute demo?",
        "Most HVAC businesses I work with tell me their biggest untapped opportunity is past customers who haven't called back in 12-18 months. I've built an AI system that reactivates them automatically. Would it be worth 10 minutes to see it working?",
        "It sounds like the gap between quotes sent and jobs closed is where most HVAC revenue gets left on the table. I've built an AI dead lead revival system specifically for HVAC companies. Would it be crazy to spend 10 minutes seeing what it recovers?",
      ]

      const injuryLinkedIn = [
        "It sounds like following up with every enquiry that went cold is one of those things that gets lost when your team is focused on active cases. Most personal injury firms I speak to have hundreds of cold leads who never signed. I've built an AI system that reactivates them automatically. Worth 10 minutes?",
        "Most PI attorneys I work with tell me their biggest missed opportunity is leads who enquired, showed initial interest, but never converted. I've built an AI reactivation system specifically for personal injury firms. Would it be worth a quick demo?",
        "It sounds like the gap between initial enquiry and signed retainer is where most personal injury revenue disappears. I've built an AI system that closes that gap automatically. Would it be crazy to spend 10 minutes seeing it?",
      ]

      const allMessages: Array<{
        user_id: string
        offer_id: string
        message_text: string
        channel: string
        status: string
        sent_at: string | null
        subject_line?: string | null
      }> = []

      // Dental — 14 sent LinkedIn, 3 sent Instagram, 3 sent email, 6 draft LinkedIn
      dentalLinkedIn.forEach((text, i) => {
        allMessages.push({
          user_id: userId,
          offer_id: dentalOffer.id,
          message_text: text,
          channel: "linkedin",
          status: i < 5 ? "sent" : "draft",
          sent_at: i < 5 ? new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000).toISOString() : null,
        })
      })

      // Add more sent messages for dental to reach 14 sent
      for (let i = 0; i < 9; i++) {
        allMessages.push({
          user_id: userId,
          offer_id: dentalOffer.id,
          message_text: `It sounds like patient reactivation is one of those things that gets reactive rather than proactive. I've built an AI system specifically for dental practices. Would it be worth 10 minutes? (${i + 6})`,
          channel: i < 3 ? "instagram" : i < 6 ? "email" : "linkedin",
          status: "sent",
          sent_at: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toISOString(),
          subject_line: i >= 3 && i < 6 ? "Quick question about your patient database" : null,
        })
      }

      // Add 6 drafts for dental
      for (let i = 0; i < 6; i++) {
        allMessages.push({
          user_id: userId,
          offer_id: dentalOffer.id,
          message_text: `Draft message ${i + 1} for dental outreach — ready to send`,
          channel: "linkedin",
          status: "draft",
          sent_at: null,
        })
      }

      // HVAC — 17 sent, 3 draft
      hvacLinkedIn.forEach((text, i) => {
        allMessages.push({
          user_id: userId,
          offer_id: hvacOffer.id,
          message_text: text,
          channel: "linkedin",
          status: "sent",
          sent_at: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000).toISOString(),
        })
      })

      for (let i = 0; i < 14; i++) {
        allMessages.push({
          user_id: userId,
          offer_id: hvacOffer.id,
          message_text: `HVAC outreach message ${i + 4} — dormant quote reactivation system demo invite`,
          channel: i < 5 ? "linkedin" : i < 10 ? "email" : "instagram",
          status: i < 11 ? "sent" : "draft",
          sent_at: i < 11 ? new Date(Date.now() - (6 - Math.floor(i / 2)) * 24 * 60 * 60 * 1000).toISOString() : null,
          subject_line: i >= 5 && i < 10 ? "Your unconverted HVAC quotes" : null,
        })
      }

      // Personal Injury — 16 sent, 4 draft
      injuryLinkedIn.forEach((text, i) => {
        allMessages.push({
          user_id: userId,
          offer_id: injuryOffer.id,
          message_text: text,
          channel: "linkedin",
          status: "sent",
          sent_at: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000).toISOString(),
        })
      })

      for (let i = 0; i < 13; i++) {
        allMessages.push({
          user_id: userId,
          offer_id: injuryOffer.id,
          message_text: `Personal injury outreach message ${i + 4} — cold lead reactivation system`,
          channel: i < 5 ? "linkedin" : i < 9 ? "instagram" : "email",
          status: i < 9 ? "sent" : "draft",
          sent_at: i < 9 ? new Date(Date.now() - (4 - Math.floor(i / 3)) * 24 * 60 * 60 * 1000).toISOString() : null,
        })
      }

      const { error: messagesError } = await supabase
        .from("outreach_messages")
        .insert(allMessages)

      if (messagesError) {
        addLog(`✗ Failed to create messages: ${messagesError.message}`)
      } else {
        addLog(`✓ ${allMessages.length} outreach messages created across 3 niches`)
      }

      // Step 4 — Create 12 reply threads
      addLog("Step 4: Creating 12 reply threads...")

      const { data: sentMessages } = await supabase
        .from("outreach_messages")
        .select("id, offer_id")
        .eq("user_id", userId)
        .eq("status", "sent")
        .limit(12)

      const replyData = [
        { prospect_reply: "Hi, this is interesting actually. We do have a lot of patients we haven't heard from in a while. How does it work exactly?", response_sent: true, suggested_response: "It sounds like you've already identified the opportunity. Rather than explain it, would it be crazy to spend 10 minutes seeing it working on a practice like yours on a quick screen share?" },
        { prospect_reply: "We tried something similar before and it didn't really work for us", response_sent: true, suggested_response: "That makes complete sense — most tools in this space are generic. What I've built is specifically trained on dental patient conversations. Would it be worth 10 minutes to see how it's different?" },
        { prospect_reply: "Can you send me more information?", response_sent: true, suggested_response: "I could send something over — but honestly the system is something you need to see working to appreciate it. Would it be crazy to grab a 10-minute slot this week?" },
        { prospect_reply: "Yes this looks relevant — we have hundreds of old quotes we never followed up on. When can we talk?", response_sent: true, suggested_response: "That's exactly what this is built for. I have availability Thursday or Friday this week — would either of those work for a quick 10-minute screen share?" },
        { prospect_reply: "Interesting — how much does it cost?", response_sent: true, suggested_response: "It's completely performance-based — you only pay when we recover revenue for you. No upfront cost, no retainer. Would it be worth 10 minutes to see the system working before we talk numbers?" },
        { prospect_reply: "We're actually looking at this kind of solution right now. Can we set up a call?", response_sent: true, suggested_response: "Perfect timing. I have slots Thursday at 2pm or Friday at 10am — which works better for a 10-minute screen share?" },
        { prospect_reply: "Not interested right now, maybe in a few months", response_sent: false, suggested_response: "That makes complete sense — timing is everything. Would it be okay if I checked back in around June when you're closer to that window?" },
        { prospect_reply: "How long does setup take?", response_sent: false, suggested_response: "It sounds like speed of implementation matters for you. We can have the system live within 48 hours of getting access. Would it be worth 10 minutes to see the full setup process on a quick screen share?" },
        { prospect_reply: "This is exactly what we need. We have loads of old leads that went cold. Can you show me more?", response_sent: false, suggested_response: "It sounds like you've already felt this problem. The best way to show you more is a live 10-minute demo — would it be crazy to jump on a quick screen share this week?" },
        { prospect_reply: "What kind of results have you seen with other practices?", response_sent: false, suggested_response: "Rather than give you numbers, I'd rather show you the system working on a scenario that matches your practice — takes 10 minutes and you'll see exactly what to expect. Would that be worth your time?" },
        { prospect_reply: "Do you work with HVAC companies specifically?", response_sent: false, suggested_response: "Yes — HVAC is one of the highest ROI niches for this system because of average job values. Would it be worth 10 minutes to see it working on an HVAC scenario?" },
        { prospect_reply: "Sounds good — send me a calendar link", response_sent: false, suggested_response: "Here you go — grab a 10-minute slot that works for you and I'll have everything ready to show you live." },
      ]

      if (sentMessages && sentMessages.length > 0) {
        for (let i = 0; i < Math.min(replyData.length, sentMessages.length); i++) {
          await supabase.from("reply_threads").insert({
            user_id: userId,
            outreach_message_id: sentMessages[i].id,
            prospect_reply: replyData[i].prospect_reply,
            suggested_response: replyData[i].suggested_response,
            response_sent: replyData[i].response_sent,
            response_sent_at: replyData[i].response_sent ? new Date(Date.now() - (8 - i) * 24 * 60 * 60 * 1000).toISOString() : null,
            response_goal: "Book a 10-minute Coffee Date Demo call",
          })
          await supabase
            .from("outreach_messages")
            .update({ status: "replied" })
            .eq("id", sentMessages[i].id)
        }
      }

      addLog("✓ 12 reply threads created — 6 responded, 6 pending")

      // Step 5 — Create 4 completed call scripts
      addLog("Step 5: Creating 4 completed call scripts...")

      const callScripts = [
        {
          user_id: userId,
          offer_id: dentalOffer.id,
          opening: "Thank you for taking the time. I want to keep this to 10 minutes. I'm going to show you the system working on a dental practice scenario and then we can see if it makes sense for yours.",
          qualification_questions: "How many active patients do you have? How many haven't booked in 12+ months? Do you have any current reactivation system?",
          objection_responses: "If they mention cost: completely performance-based, you only pay on results. If they tried something similar: this is trained specifically on dental conversations.",
          close_ask: "Based on what you've seen, does this look like something worth running on your practice for 30 days?",
          call_completed: true,
          call_completed_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          call_notes: "Dr Sarah Mitchell — Mitchell Family Dental. 4,200 patients, ~1,800 dormant. No current reactivation system. Very interested. Requested proposal.",
        },
        {
          user_id: userId,
          offer_id: dentalOffer.id,
          opening: "Great to connect. I'll keep this to 10 minutes — I want to show you the AI system working live and you can tell me whether it's relevant for your practice.",
          qualification_questions: "What does your current patient follow-up process look like? How do you currently handle patients who haven't booked in over a year?",
          objection_responses: "If they ask about data security: fully HIPAA compliant, no patient data leaves their system. If they ask about contract length: month to month, performance only.",
          close_ask: "This looks like a strong fit for your practice. Shall we get the system live in the next 48 hours?",
          call_completed: true,
          call_completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          call_notes: "Dr James Okafor — Okafor Dental Group. 3 locations, combined 8,000+ patients. Very engaged during demo. Asked about multi-location rollout. Follow up with proposal covering all 3 sites.",
        },
        {
          user_id: userId,
          offer_id: hvacOffer.id,
          opening: "Thanks for jumping on — I'll keep this tight. I'm going to show you the AI system handling a real HVAC scenario live and you can see exactly what your customers would experience.",
          qualification_questions: "How many unconverted quotes do you have in your system from the last 2 years? What's your average job value? Do you have a CRM?",
          objection_responses: "If they mention they use GHL already: perfect, we plug directly into GoHighLevel. If they ask about the AI sounding robotic: I'll show you a live conversation — judge for yourself.",
          close_ask: "Based on what you've seen, is there a reason not to run this on your cold quote database for 30 days?",
          call_completed: true,
          call_completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          call_notes: "Mike Thornton — Thornton HVAC Solutions. Approx 600 unconverted quotes over 2 years. Average job $1,400. Uses GHL. Very interested in performance model. Proposal requested.",
        },
        {
          user_id: userId,
          offer_id: hvacOffer.id,
          opening: "Good to speak with you. I want to show you something in the next 10 minutes that I think will change how you look at your existing customer database.",
          qualification_questions: "How do you currently follow up with customers who requested a quote but never confirmed? What's your typical close rate on quotes?",
          objection_responses: "If they say their team already handles follow-up: great — this supplements what they do, it doesn't replace anyone. Works nights and weekends too.",
          close_ask: "This is a no-risk way to recover revenue that's already sitting in your system. Want to get started this week?",
          call_completed: true,
          call_completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          call_notes: "Karen Ellis — Ellis Climate Control. Family business, 15 years. 400+ old quotes. Husband is sceptical but Karen is the decision maker and loves the demo. Sending proposal to Karen directly.",
        },
      ]

      await supabase.from("call_scripts").insert(callScripts)
      addLog("✓ 4 completed call scripts created")

      // Step 6 — Create 4 proposals (2 won, 1 pending, 1 ghosted)
      addLog("Step 6: Creating 4 proposals...")

      const proposals = [
        {
          user_id: userId,
          offer_id: dentalOffer.id,
          prospect_name: "Dr Sarah Mitchell",
          prospect_business: "Mitchell Family Dental",
          problem_summary: "Mitchell Family Dental has approximately 1,800 dormant patients who have not booked in over 12 months. With an average treatment value of $380, this represents significant recoverable revenue sitting untouched in their existing patient database.",
          solution_summary: "We deploy an AI-powered patient reactivation system that sends personalised SMS sequences to dormant patients at optimal times, handling responses automatically until an appointment is booked.",
          deliverables: "AI SMS reactivation sequences deployed within 48 hours. Personalised messaging for up to 1,800 dormant patients. Automated response handling. Monthly reporting on reactivated patients and revenue recovered.",
          investment: "50% of net revenue recovered from reactivated patients. Zero upfront cost. Zero retainer.",
          guarantee: "If we do not reactivate a minimum of 15 patients in the first 30 days, we continue working at no charge until we do.",
          next_step: "Sign the agreement and provide CRM access. Live within 48 hours.",
          confidence_score: "strong",
          confidence_reason: "Large dormant database, performance model removes risk, prospect expressed strong interest.",
          sent: true,
          sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          deal_status: "won",
        },
        {
          user_id: userId,
          offer_id: hvacOffer.id,
          prospect_name: "Mike Thornton",
          prospect_business: "Thornton HVAC Solutions",
          problem_summary: "Thornton HVAC Solutions has approximately 600 unconverted quotes from the past 2 years sitting dormant in their system. With an average job value of $1,400, even a 10% reactivation rate represents significant recoverable revenue.",
          solution_summary: "We deploy an AI dead lead revival system that re-engages unconverted quotes automatically using personalised SMS sequences through their existing GoHighLevel account.",
          deliverables: "Integration with existing GoHighLevel account within 24 hours. Personalised reactivation sequences for up to 600 dormant quotes. Automated follow-up handling. Weekly performance reporting.",
          investment: "50% of net revenue recovered from reactivated jobs. No upfront cost. Performance only.",
          guarantee: "Minimum 5 converted jobs in the first 30 days or we continue at no charge.",
          next_step: "Share GoHighLevel access and we will have campaigns live within 24 hours.",
          confidence_score: "strong",
          confidence_reason: "GHL already in place, high average job value, enthusiastic prospect.",
          sent: true,
          sent_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          deal_status: "won",
        },
        {
          user_id: userId,
          offer_id: dentalOffer.id,
          prospect_name: "Dr James Okafor",
          prospect_business: "Okafor Dental Group",
          problem_summary: "Okafor Dental Group operates 3 locations with a combined patient database of over 8,000 patients. An estimated 30% have not booked in over 12 months across all sites.",
          solution_summary: "A multi-location AI patient reactivation system deployed across all three practices simultaneously, with location-specific messaging and centralised performance reporting.",
          deliverables: "AI reactivation system deployed across all 3 locations. Location-specific personalised SMS sequences. Centralised dashboard tracking performance per site. Monthly reporting.",
          investment: "50% of net revenue recovered across all locations. Single agreement covering all three sites.",
          guarantee: "Minimum 40 reactivated patients across all locations in the first 30 days.",
          next_step: "Review and sign. We will coordinate with your practice managers at each location.",
          confidence_score: "strong",
          confidence_reason: "Multi-location deal significantly increases revenue potential. Prospect is engaged and decision-ready.",
          sent: true,
          sent_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          deal_status: "pending",
        },
        {
          user_id: userId,
          offer_id: hvacOffer.id,
          prospect_name: "Karen Ellis",
          prospect_business: "Ellis Climate Control",
          problem_summary: "Ellis Climate Control has over 400 unconverted quotes sitting in their system. The owner is interested but husband and co-owner is sceptical about AI.",
          solution_summary: "AI-powered quote reactivation system deployed through their existing systems, handling follow-up automatically across their dormant prospect database.",
          deliverables: "AI reactivation sequences for 400+ dormant quotes. Automated follow-up handling. Weekly reporting showing exact revenue recovered.",
          investment: "50% of net revenue recovered. No upfront cost.",
          guarantee: "Minimum 3 converted jobs in first 30 days.",
          next_step: "Awaiting sign-off from both owners.",
          confidence_score: "needs_work",
          confidence_reason: "Decision requires buy-in from sceptical co-owner. Karen is the champion but may need more time.",
          sent: true,
          sent_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          deal_status: "ghosted",
        },
      ]

      await supabase.from("proposals").insert(proposals)
      addLog("✓ 4 proposals created — 2 won, 1 pending, 1 ghosted")

      // Step 7 — Create 2 AI audits (client submitted)
      addLog("Step 7: Creating 2 AI audits...")

      const audits = [
        {
          user_id: userId,
          name: "Mitchell Family Dental",
          website_url: "https://mitchellfamilydental.com",
          industry: "Healthcare — Dental",
          business_size: "Small (2-10 employees)",
          status: "completed",
          completion_percentage: 100,
          prospect_name: "Dr Sarah Mitchell",
          prospect_email: "sarah@mitchellfamilydental.com",
          prospect_submitted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          responses: {
            business_name: "Mitchell Family Dental",
            business_description: "Family dental practice serving the local community for 18 years.",
            business_goals: "Grow patient numbers, improve retention, reduce reliance on paid advertising",
            current_tools: "Dentrix practice management software, email newsletters, basic Facebook page",
            old_leads: "Yes definitely — we have thousands of patients who came in a few years ago and we haven't heard from them since",
            ai_experience: "Beginner",
            automate_tomorrow: "Following up with patients we haven't seen in over a year",
          },
          ai_insights: {
            bottlenecks: [
              { issue: "No systematic dormant patient reactivation", evidence: "Thousands of patients haven't been contacted in years", impact: "Significant lost revenue from existing relationship base" },
              { issue: "Manual patient communication consuming front desk time", evidence: "2-3 hours daily on repetitive questions", impact: "Staff capacity wasted on tasks AI can handle" },
            ],
            quick_wins: [
              { action: "Deploy AI dormant patient reactivation", timeline: "48 hours", outcome: "Re-engage 15-20% of dormant patients within 30 days" },
              { action: "AI FAQ chatbot for website", timeline: "1 week", outcome: "Eliminate 2-3 hours of daily repetitive questions from front desk" },
            ],
            financial_impact: "Based on 1,800 dormant patients and an average treatment value of $380, reactivating just 5% generates $34,200 in recovered revenue.",
          },
          executive_summary: "Mitchell Family Dental has built strong patient relationships over 18 years but is leaving significant revenue on the table through an untouched dormant patient database.",
          service_recommendations: [
            { service: "Dead Lead Revival", priority: "critical", problem_solved: "1,800+ dormant patients with no reactivation system", expected_outcome: "15-20% reactivation rate within 30 days", pricing_model: "50% profit share on recovered revenue" },
          ],
          report_ready: true,
          completed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          user_id: userId,
          name: "Thornton HVAC Solutions",
          website_url: "https://thorntonhvac.com",
          industry: "Home Services — HVAC",
          business_size: "Small (2-10 employees)",
          status: "completed",
          completion_percentage: 100,
          prospect_name: "Mike Thornton",
          prospect_email: "mike@thorntonhvac.com",
          prospect_submitted_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          responses: {
            business_name: "Thornton HVAC Solutions",
            business_description: "Family-owned HVAC company. Residential and light commercial installation, repair and maintenance.",
            business_goals: "Close more of the quotes we send out, stop losing jobs to competitors",
            current_tools: "GoHighLevel CRM, QuickBooks, Google My Business",
            old_leads: "Yes — we have hundreds of quotes we sent out over the last couple of years that never went anywhere",
            ai_experience: "Experimenting",
            automate_tomorrow: "Quote follow-up — we lose so many jobs just because we didn't follow up fast enough",
          },
          ai_insights: {
            bottlenecks: [
              { issue: "Unconverted quote database not being followed up systematically", evidence: "Hundreds of quotes sent over 2 years with no reactivation", impact: "Significant lost revenue to competitors from warm prospects" },
            ],
            quick_wins: [
              { action: "Deploy AI dead lead revival for 600 unconverted quotes", timeline: "24 hours via existing GHL account", outcome: "Re-engage warm prospects before they commit to competitors" },
            ],
            financial_impact: "With 600 unconverted quotes at an average job value of $1,400, reactivating just 8% generates $67,200 in recovered revenue.",
          },
          executive_summary: "Thornton HVAC Solutions is losing significant revenue through an unconverted quote database that has never been systematically followed up.",
          service_recommendations: [
            { service: "Dead Lead Revival", priority: "critical", problem_solved: "600 unconverted quotes with no follow-up system", expected_outcome: "8-12% reactivation rate within 30 days", pricing_model: "50% profit share on recovered revenue" },
          ],
          report_ready: true,
          completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]

      await supabase.from("audits").insert(audits)
      addLog("✓ 2 AI audits created — both client submitted with full insights")

      // Step 8 — Create 2 Androids
      addLog("Step 8: Creating 2 Androids...")

      const androids = [
        {
          user_id: userId,
          name: "Grace",
          company_name: "Mitchell Family Dental",
          niche: "Dental Practices",
          prompt: "You are Grace, an AI assistant for Mitchell Family Dental. Your purpose is to re-engage dormant patients using tactical empathy and SPIN selling. You are warm, professional, and genuinely interested in helping patients get the dental care they need. Never break character. Ask one question at a time.",
          business_context: { website: "mitchellfamilydental.com", opening_hours: "Mon-Fri 8am-6pm, Sat 9am-2pm", calendar_link: "https://calendly.com/mitchellfamily" },
          ai_prefilled: true,
        },
        {
          user_id: userId,
          name: "Marcus",
          company_name: "Thornton HVAC Solutions",
          niche: "HVAC Companies",
          prompt: "You are Marcus, an AI assistant for Thornton HVAC Solutions. Your purpose is to re-engage unconverted quotes and dormant customers using tactical empathy and SPIN selling. You are direct, knowledgeable about HVAC, and focused on helping customers solve their heating and cooling problems. Never break character. Ask one question at a time.",
          business_context: { website: "thorntonhvac.com", opening_hours: "Mon-Sat 7am-7pm, Emergency 24/7", calendar_link: "https://calendly.com/thorntonhvac" },
          ai_prefilled: true,
        },
      ]

      await supabase.from("androids").insert(androids)
      addLog("✓ 2 Androids created — Grace (Dental) and Marcus (HVAC)")

      // Step 9 — Update niche_user_state for all three niches
      addLog("Step 9: Updating niche pipeline stages...")

      const nicheNames = ["Dental", "HVAC", "Personal Injury"]
      const nicheStages = ["revival", "demo", "outreach"]
      const offerIds = [dentalOffer.id, hvacOffer.id, injuryOffer.id]

      for (let i = 0; i < nicheNames.length; i++) {
        const { data: niche, error: nicheError } = await supabase
          .from("niches")
          .select("id, niche_name")
          .ilike("niche_name", `%${nicheNames[i]}%`)
          .limit(1)
          .maybeSingle()

        if (nicheError) {
          addLog(`✗ Niche lookup error for ${nicheNames[i]}: ${nicheError.message}`)
          continue
        }

        if (!niche) {
          addLog(`✗ Niche not found: ${nicheNames[i]}`)
          continue
        }

        addLog(`  Found niche: ${niche.niche_name} (${niche.id})`)

        const { error: upsertError } = await supabase
          .from("niche_user_state")
          .upsert({
            user_id: userId,
            niche_id: niche.id,
            is_favourite: true,
            stage: nicheStages[i],
            offer_id: offerIds[i],
            outreach_generated: true,
            outreach_start_date: new Date(Date.now() - (10 - i * 3) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            outreach_messages_sent: i === 0 ? 14 : i === 1 ? 17 : 16,
            coffee_date_completed: i < 2,
            ghl_connected: i === 0,
            android_built: i < 2,
            status: i === 0 ? "Win" : i === 1 ? "Coffee Date Demo" : "Outreach in Progress",
            win_completed: i === 0,
            win_completed_at: i === 0 ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() : null,
            win_type: i === 0 ? "revival" : null,
          }, { onConflict: "user_id,niche_id" })

        if (upsertError) {
          addLog(`✗ Failed to update niche_user_state for ${nicheNames[i]}: ${upsertError.message}`)
        } else {
          addLog(`  ✓ ${nicheNames[i]} niche state updated with status: ${i === 0 ? "Win" : i === 1 ? "Coffee Date Demo" : "Outreach in Progress"}`)
        }
      }

      addLog("✓ Niche pipeline stages updated — Dental (Revival), HVAC (Demo), PI (Outreach)")

      // Step 10 — Update outreach table and profiles
      addLog("Step 10: Finalizing sprint data...")

      await supabase
        .from("outreach")
        .upsert({
          user_id: userId,
          started: true,
          messages_generated: true,
          first_sent_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          total_sent: 47,
        }, { onConflict: "user_id" })

      await supabase
        .from("profiles")
        .update({
          sprint_start_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          offer_id: dentalOffer.id,
        })
        .eq("id", userId)

      addLog("✓ Sprint set to Day 10 — 47 messages sent total")
      addLog("")
      addLog("✓ Demo data complete — your account is ready to record")
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
          Populates your account with realistic pipeline data for Day 10 of a sprint. Creates a fully populated account that looks like a successful user across every feature of the product.
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
                <div key={i} style={{ color: log.includes("✓") ? "#22c55e" : log.includes("✗") ? "#ef4444" : log.startsWith("Step") ? "#00AAFF" : "rgba(255,255,255,0.6)" }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary card */}
        {isComplete && (
          <>
            <div style={{ marginBottom: "24px", padding: "16px", background: "rgba(0,170,255,0.06)", border: "0.5px solid rgba(0,170,255,0.2)", borderRadius: "8px" }}>
              <p style={{ color: "#00AAFF", fontWeight: "700", marginBottom: "8px" }}>Account ready for recording:</p>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", lineHeight: "1.8", margin: 0 }}>
                • Day 10 of 14 sprint<br/>
                • 3 active niches at different pipeline stages<br/>
                • 47 messages sent across LinkedIn, Instagram, Email<br/>
                • 12 replies received<br/>
                • 4 calls completed<br/>
                • 4 proposals (2 won, 1 pending, 1 ghosted)<br/>
                • 2 AI audits with full Claude insights<br/>
                • 2 Androids built (Grace and Marcus)<br/>
                • Dental niche at Revival stage (GHL connected)<br/>
                • HVAC niche at Demo stage<br/>
                • Personal Injury niche at Outreach stage
              </p>
            </div>
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
                cursor: "pointer",
              }}
            >
              Go to Mission Control
            </button>
          </>
        )}
      </div>
    </div>
  )
}
