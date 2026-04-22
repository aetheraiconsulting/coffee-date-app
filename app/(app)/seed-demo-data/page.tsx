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
          price_point: "50% of net profit recovered",
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
          price_point: "50% of net profit recovered",
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
          solution_summary: "We deploy an AI-powered patient reactivation system that sends personalized SMS sequences to dormant patients at optimal times, handling responses automatically until an appointment is booked.",
          deliverables: "AI SMS reactivation sequences deployed within 48 hours. Personalized messaging for up to 1,800 dormant patients. Automated response handling. Monthly reporting on reactivated patients and revenue recovered.",
          investment: "50% of net profit recovered from reactivated patients. Zero upfront cost. Zero retainer.",
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
          solution_summary: "We deploy an AI dead lead revival system that re-engages unconverted quotes automatically using personalized SMS sequences through their existing GoHighLevel account.",
          deliverables: "Integration with existing GoHighLevel account within 24 hours. Personalized reactivation sequences for up to 600 dormant quotes. Automated follow-up handling. Weekly performance reporting.",
          investment: "50% of net profit recovered from reactivated jobs. No upfront cost. Performance only.",
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
          solution_summary: "A multi-location AI patient reactivation system deployed across all three practices simultaneously, with location-specific messaging and centralized performance reporting.",
          deliverables: "AI reactivation system deployed across all 3 locations. Location-specific personalized SMS sequences. Centralized dashboard tracking performance per site. Monthly reporting.",
          investment: "50% of net profit recovered across all locations. Single agreement covering all three sites.",
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
          investment: "50% of net profit recovered. No upfront cost.",
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

      // Step 7 — Create 2 AI audits (client submitted, completed with full insights)
      addLog("Step 7: Creating 2 AI audits...")

      // Delete existing audits first to avoid duplicates
      const { error: deleteAuditsError } = await supabase
        .from("audits")
        .delete()
        .eq("user_id", userId)

      if (deleteAuditsError) {
        addLog(`  Warning: Could not delete existing audits: ${deleteAuditsError.message}`)
      } else {
        addLog("  Cleared existing audits")
      }

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
          shared_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          teaser_content: "Your dental practice has a hidden goldmine: 1,800 dormant patients who haven't been contacted in years. Based on your average treatment value of $380, reactivating just 5% could generate over $34,000 in recovered revenue.",
          responses: {
            // Business Overview (5 questions)
            business_name: "Mitchell Family Dental",
            website_url: "https://mitchellfamilydental.com",
            business_description: "Family dental practice serving the local community for 18 years. We focus on preventive care and building long-term patient relationships. Our team includes 2 dentists, 4 hygienists, and 3 front desk staff.",
            business_goals: "Grow patient numbers by 20%, improve retention rates, reduce reliance on paid advertising, and streamline administrative tasks that are eating up staff time.",
            current_tools: "Dentrix practice management software for scheduling and patient records, Mailchimp for email newsletters, basic Facebook page for social media presence.",
            // Marketing & Lead Generation (5 questions)
            lead_generation: "Mostly word of mouth referrals from existing patients. We do some Google Ads for specific services like Invisalign and teeth whitening. Occasional Facebook posts but no real strategy.",
            lead_capture: "We have a basic contact form on our website that goes to our front desk email. No CRM — everything is managed manually in Dentrix and spreadsheets.",
            lead_followup: "Front desk calls new enquiries when they have time, usually within 24-48 hours. If they don't answer, we leave a voicemail but rarely follow up again.",
            old_leads: "Yes definitely — we have thousands of patients who came in a few years ago and we haven't heard from them since. Our database has about 4,500 patients but only 1,200 are active (seen in last 12 months).",
            marketing_spend: "About $2,500/month on Google Ads, plus maybe $500 on printing and local sponsorships. Most of our time is spent just running the practice day-to-day.",
            // Sales & Customer Journey (5 questions)
            sales_process: "Patient finds us online or gets referred, calls or fills out form, front desk books appointment, patient comes in for initial exam, we present treatment plan, patient decides to proceed or think about it.",
            sales_steps: "5 main steps: enquiry, booking, first visit, treatment planning, acceptance. Front desk handles 1-2, dentists handle 3-4, admin handles follow-up on 5.",
            manual_tasks: "Treatment plan follow-ups are completely manual — we're supposed to call patients who haven't accepted their treatment plan but it rarely happens. Appointment reminders are also manual phone calls.",
            sales_metrics: "We track basic numbers like new patients per month and production per provider, but nothing sophisticated. No conversion rates or response times tracked.",
            sales_cycle: "For routine work like cleanings, same day to 2 weeks. For bigger treatment plans like crowns or implants, can be 1-3 months as people think about it and check insurance.",
            // Operations & Delivery (5 questions)
            time_consuming_tasks: "Answering phone calls (2-3 hours daily), confirming appointments manually, following up on unpaid invoices, processing insurance claims, and trying to re-engage patients who haven't been in for a while.",
            automation_candidates: "Definitely appointment reminders and confirmations. Also patient re-engagement — we know we should reach out to dormant patients but there's never time. Insurance verification would help too.",
            recurring_admin: "Yes — weekly reports for each provider, monthly insurance reconciliation, daily appointment confirmation calls, and quarterly recall reminders that we try to do but often skip.",
            team_communication: "Mostly in-person huddles in the morning, then just shouting across the office. We use a shared Outlook calendar but no project management tools.",
            scaling_bottleneck: "Front desk capacity. They're drowning in phone calls and admin work. We could see more patients if they weren't spending half their day on the phone answering the same questions.",
            // Customer Service & Retention (5 questions)
            customer_support: "Phone calls during business hours, email that gets checked a few times a day. No after-hours support except for emergencies which go to the on-call dentist's personal phone.",
            support_automation: "Nothing automated. Every call and email is handled individually by the front desk team.",
            repetitive_questions: "Probably 2-3 hours daily on questions like office hours, do you accept my insurance, how do I reschedule, what's included in a cleaning, how much does X cost. Same questions every day.",
            customer_feedback: "We ask patients to leave Google reviews if they're happy, but no formal system. Maybe 1 in 20 patients actually leaves a review.",
            customer_retention: "We're supposed to send recall reminders at 6 months but it's inconsistent. No system for re-engaging patients who haven't been in for a year or more. No upselling or cross-selling programs.",
            // AI Awareness & Readiness (5 questions)
            ai_experience: "Beginner — we haven't really explored AI yet but open to learning. I've heard about ChatGPT but haven't used it for the practice.",
            automation_explored: "We tried setting up automated emails through Mailchimp but couldn't figure out how to integrate it with Dentrix. Gave up after a few weeks.",
            ai_hesitation: "Worried about it feeling impersonal to patients. Also concerned about HIPAA compliance and whether AI can actually handle the nuances of dental patient communication.",
            automate_tomorrow: "Following up with patients we haven't seen in over a year — it's just impossible to do manually. We have 3,300 dormant patients and no way to reach out to all of them.",
            success_metric: "If we could reactivate even 10% of our dormant patients, that would be over 300 people. At an average treatment value of $380, that's over $100K in recovered revenue. That would be a massive win.",
          },
          ai_insights: {
            bottlenecks: [
              { issue: "No systematic dormant patient reactivation", evidence: "Thousands of patients haven't been contacted in years", impact: "Significant lost revenue from existing relationship base", priority: "critical" },
              { issue: "Manual patient communication consuming front desk time", evidence: "2-3 hours daily on repetitive questions", impact: "Staff capacity wasted on tasks AI can handle", priority: "high" },
              { issue: "No automated appointment reminder system", evidence: "Manual phone calls for reminders", impact: "No-shows costing an estimated $800-1,200 per week", priority: "medium" },
            ],
            quick_wins: [
              { action: "Deploy AI dormant patient reactivation", timeline: "48 hours", outcome: "Re-engage 15-20% of dormant patients within 30 days", estimated_value: "$34,200" },
              { action: "AI FAQ chatbot for website", timeline: "1 week", outcome: "Eliminate 2-3 hours of daily repetitive questions from front desk", estimated_value: "$2,400/month in saved labour" },
              { action: "Automated SMS appointment reminders", timeline: "24 hours", outcome: "Reduce no-shows by 40-60%", estimated_value: "$400-720/week recovered" },
            ],
            financial_impact: "Based on 1,800 dormant patients and an average treatment value of $380, reactivating just 5% generates $34,200 in recovered revenue. Combined with reduced no-shows and saved admin time, total first-year impact could exceed $60,000.",
            competitive_advantage: "Your 18 years of patient relationships is your biggest asset — but only if you can systematically re-engage those dormant patients before they find another dentist.",
          },
          executive_summary: "Mitchell Family Dental has built strong patient relationships over 18 years but is leaving significant revenue on the table through an untouched dormant patient database. The practice has approximately 1,800 patients who haven't been seen in 12+ months, representing over $34,000 in immediate recoverable revenue. Additionally, manual patient communication is consuming 2-3 hours of front desk time daily that could be eliminated with AI automation.",
          service_recommendations: [
            { service: "Dead Lead Revival", priority: "critical", problem_solved: "1,800+ dormant patients with no reactivation system", expected_outcome: "15-20% reactivation rate within 30 days", pricing_model: "50% of net profit recovered", implementation_time: "48 hours" },
            { service: "AI Patient Concierge", priority: "high", problem_solved: "2-3 hours daily answering repetitive patient questions", expected_outcome: "80% reduction in routine enquiries to front desk", pricing_model: "$497/month", implementation_time: "1 week" },
          ],
          edited_insights: {
            executive_summary: "Mitchell Family Dental has built strong patient relationships over 18 years but is leaving significant revenue on the table through an untouched dormant patient database. The practice has approximately 1,800 patients who haven't been seen in 12+ months, representing over $34,000 in immediate recoverable revenue. Additionally, manual patient communication is consuming 2-3 hours of front desk time daily that could be eliminated with AI automation.",
            bottlenecks: [
              { issue: "No systematic dormant patient reactivation", evidence: "Thousands of patients haven't been contacted in years", impact: "Significant lost revenue from existing relationship base" },
              { issue: "Manual patient communication consuming front desk time", evidence: "2-3 hours daily on repetitive questions", impact: "Staff capacity wasted on tasks AI can handle" },
              { issue: "No automated appointment reminder system", evidence: "Manual phone calls for reminders", impact: "No-shows costing an estimated $800-1,200 per week" },
            ],
            quick_wins: [
              { action: "Deploy AI dormant patient reactivation", timeline: "48 hours", outcome: "Re-engage 15-20% of dormant patients within 30 days" },
              { action: "AI FAQ chatbot for website", timeline: "1 week", outcome: "Eliminate 2-3 hours of daily repetitive questions from front desk" },
              { action: "Automated SMS appointment reminders", timeline: "24 hours", outcome: "Reduce no-shows by 40-60%" },
            ],
            roadmap: [
              { phase: "Week 1", focus: "Deploy dormant patient reactivation campaign", outcome: "Begin re-engaging 1,800+ dormant patients" },
              { phase: "Week 2-3", focus: "Implement AI appointment reminders and confirmations", outcome: "Reduce no-shows by 40-60%" },
              { phase: "Month 2", focus: "Add AI chatbot for common patient questions", outcome: "Free up 2-3 hours of front desk time daily" },
            ],
            financial_impact: "Based on 1,800 dormant patients and an average treatment value of $380, reactivating just 5% generates $34,200 in recovered revenue. Combined with reduced no-shows and saved admin time, total first-year impact could exceed $60,000.",
            service_recommendations: [
              { service: "Dead Lead Revival", priority: "critical", problem_solved: "1,800+ dormant patients with no reactivation system", expected_outcome: "15-20% reactivation rate within 30 days", pricing_model: "50% of net profit recovered", why_now: "Every day without reactivation is lost revenue to competing practices", included: true },
              { service: "AI Patient Concierge", priority: "high", problem_solved: "2-3 hours daily answering repetitive patient questions", expected_outcome: "80% reduction in routine enquiries to front desk", pricing_model: "$497/month", why_now: "Front desk is at capacity — automation frees them for higher-value tasks", included: true },
            ],
          },
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
          shared_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          teaser_content: "Your HVAC business has 600 unconverted quotes sitting in your CRM — that's over $840,000 in potential revenue that went cold. At your average job value of $1,400, reactivating just 8% would recover $67,200.",
          responses: {
            // Business Overview (5 questions)
            business_name: "Thornton HVAC Solutions",
            website_url: "https://thorntonhvac.com",
            business_description: "Family-owned HVAC company serving residential and light commercial customers. Installation, repair, and maintenance for heating and cooling systems. Been in business for 12 years with 8 technicians and 2 office staff.",
            business_goals: "Close more of the quotes we send out (currently around 35% close rate), stop losing jobs to competitors who follow up faster, and build recurring revenue through maintenance agreements.",
            current_tools: "GoHighLevel CRM for leads and some automation, QuickBooks for invoicing, Google My Business for reviews, ServiceTitan for dispatch (just started using it).",
            // Marketing & Lead Generation (5 questions)
            lead_generation: "Google Ads (about 60% of leads), Google My Business organic, Nextdoor, some referrals from real estate agents we've built relationships with. Tried HomeAdvisor but the lead quality was terrible.",
            lead_capture: "All leads go into GoHighLevel. Website form, phone calls logged by office staff, and Google Ads leads automatically sync. Pretty good at capturing, not great at following up.",
            lead_followup: "Office tries to call back within 2-4 hours during business hours. After hours leads wait until morning. If we miss them, we try once more then they go cold.",
            old_leads: "Yes — we have hundreds of quotes we sent out over the last couple of years that never went anywhere. I pulled a report last week and there's 600+ unconverted quotes just sitting there. We just don't have time to follow up on all of them.",
            marketing_spend: "About $1,500/month on Google Ads, $500 on various subscriptions and software. Time-wise, basically zero — no one has bandwidth to do marketing properly.",
            // Sales & Customer Journey (5 questions)
            sales_process: "Lead comes in, office calls back, technician goes out for estimate, we send quote via email, customer either books or ghosts us. For maintenance agreements, similar but we pitch it during service calls.",
            sales_steps: "4 main steps: lead response, site visit/estimate, quote delivery, close. Office handles 1, techs handle 2-3, office handles 4 and scheduling.",
            manual_tasks: "Quote follow-up is completely manual and barely happens. Maintenance agreement renewals are manual. Seasonal check-in calls to past customers don't happen because no one has time.",
            sales_metrics: "We track quote-to-close rate (around 35%), average ticket ($1,400 for installs, $280 for repairs), and response time although we don't love what we see there.",
            sales_cycle: "Repairs are usually same-day or next-day decision. Installs take 1-2 weeks as people get multiple quotes. Biggest friction is the time between quote and decision — that's where we lose people.",
            // Operations & Delivery (5 questions)
            time_consuming_tasks: "Dispatching and scheduling (constant Tetris), answering phone calls about appointment times and costs, chasing unpaid invoices, and trying to remember to follow up on quotes.",
            automation_candidates: "Quote follow-up sequences, appointment reminders, review requests after service, and seasonal maintenance reminders to past customers.",
            recurring_admin: "Weekly payroll, monthly reports, daily dispatch scheduling, and we're supposed to do quarterly maintenance reminders but it never happens consistently.",
            team_communication: "Group text for urgent stuff, morning huddle for daily schedule, GoHighLevel tasks for follow-ups. ServiceTitan is supposed to help but we're still learning it.",
            scaling_bottleneck: "Can't grow past 8 techs because office can't handle more call volume and scheduling complexity. Also losing too many quotes to slow follow-up.",
            // Customer Service & Retention (5 questions)
            customer_support: "Phone calls during business hours, after-hours emergency line goes to on-call tech. Email but it's not checked regularly.",
            support_automation: "GoHighLevel sends appointment confirmations and some basic automations, but nothing sophisticated. No chatbot or AI.",
            repetitive_questions: "Probably 1-2 hours daily on pricing questions, appointment availability, do you service my area, how long will it take, can you come sooner. Same stuff over and over.",
            customer_feedback: "We ask for Google reviews via text after every job — that works pretty well, we have 180+ reviews. But no formal feedback collection or NPS tracking.",
            customer_retention: "Maintenance agreements are supposed to auto-renew but follow-up is inconsistent. No proactive outreach to past customers before busy seasons. We know we should but there's no time.",
            // AI Awareness & Readiness (5 questions)
            ai_experience: "Experimenting — we've played with ChatGPT for writing marketing copy and some email templates. Nothing integrated into our actual workflow though.",
            automation_explored: "GoHighLevel has some automation we use — appointment reminders, review requests. Tried to set up quote follow-up sequences but couldn't get them to feel personal enough.",
            ai_hesitation: "Worried customers will know it's not a real person and be turned off. Also concerned about AI saying the wrong thing about pricing or availability.",
            automate_tomorrow: "Quote follow-up — we lose so many jobs just because we didn't follow up fast enough. By the time we call back, they've already hired someone else. If we could automatically follow up on every quote, we'd close 10-15% more.",
            success_metric: "If we could increase close rate from 35% to 45% through better follow-up, that's an extra $84,000/year at our current quote volume. Plus reactivating those 600 old quotes could be another $100K+.",
          },
          ai_insights: {
            bottlenecks: [
              { issue: "Unconverted quote database not being followed up systematically", evidence: "Hundreds of quotes sent over 2 years with no reactivation", impact: "Significant lost revenue to competitors from warm prospects", priority: "critical" },
              { issue: "Slow response time to new quote requests", evidence: "Often takes 24-48 hours to respond", impact: "Losing jobs to competitors who respond faster", priority: "high" },
              { issue: "No automated seasonal maintenance reminders", evidence: "Relying on customers to remember to schedule", impact: "Missing recurring revenue opportunities", priority: "medium" },
            ],
            quick_wins: [
              { action: "Deploy AI dead lead revival for 600 unconverted quotes", timeline: "24 hours via existing GHL account", outcome: "Re-engage warm prospects before they commit to competitors", estimated_value: "$67,200" },
              { action: "AI instant quote response system", timeline: "48 hours", outcome: "Respond to quote requests in under 60 seconds 24/7", estimated_value: "15-20% increase in close rate" },
              { action: "Automated seasonal maintenance reminders", timeline: "1 week", outcome: "Proactively reach out to past customers before peak season", estimated_value: "$15,000-25,000/year in recurring maintenance jobs" },
            ],
            financial_impact: "With 600 unconverted quotes at an average job value of $1,400, reactivating just 8% generates $67,200 in recovered revenue. Combined with faster quote response and seasonal reminders, total first-year impact could exceed $100,000.",
            competitive_advantage: "HVAC is a speed game — the first company to respond usually wins. AI lets you respond instantly 24/7, even when your team is on jobs.",
          },
          executive_summary: "Thornton HVAC Solutions is losing significant revenue through an unconverted quote database that has never been systematically followed up. With 600 quotes at an average job value of $1,400, there's over $840,000 in potential revenue sitting dormant in their CRM. Additionally, slow response times to new quote requests are costing jobs to faster competitors.",
          service_recommendations: [
            { service: "Dead Lead Revival", priority: "critical", problem_solved: "600 unconverted quotes with no follow-up system", expected_outcome: "8-12% reactivation rate within 30 days", pricing_model: "50% of net profit recovered", implementation_time: "24 hours" },
            { service: "AI Speed to Lead", priority: "high", problem_solved: "24-48 hour response time losing jobs to competitors", expected_outcome: "Sub-60-second response time 24/7", pricing_model: "$397/month", implementation_time: "48 hours" },
          ],
          edited_insights: {
            executive_summary: "Thornton HVAC Solutions is losing significant revenue through an unconverted quote database that has never been systematically followed up. With 600 quotes at an average job value of $1,400, there's over $840,000 in potential revenue sitting dormant in their CRM. Additionally, slow response times to new quote requests are costing jobs to faster competitors.",
            bottlenecks: [
              { issue: "Unconverted quote database not being followed up systematically", evidence: "Hundreds of quotes sent over 2 years with no reactivation", impact: "Significant lost revenue to competitors from warm prospects" },
              { issue: "Slow response time to new quote requests", evidence: "Often takes 24-48 hours to respond", impact: "Losing jobs to competitors who respond faster" },
              { issue: "No automated seasonal maintenance reminders", evidence: "Relying on customers to remember to schedule", impact: "Missing recurring revenue opportunities" },
            ],
            quick_wins: [
              { action: "Deploy AI dead lead revival for 600 unconverted quotes", timeline: "24 hours via existing GHL account", outcome: "Re-engage warm prospects before they commit to competitors" },
              { action: "AI instant quote response system", timeline: "48 hours", outcome: "Respond to quote requests in under 60 seconds 24/7" },
              { action: "Automated seasonal maintenance reminders", timeline: "1 week", outcome: "Proactively reach out to past customers before peak season" },
            ],
            roadmap: [
              { phase: "Week 1", focus: "Launch dead lead revival for 600 unconverted quotes", outcome: "Begin recovering lost revenue immediately" },
              { phase: "Week 2", focus: "Deploy AI speed-to-lead for instant quote responses", outcome: "Stop losing jobs to faster competitors" },
              { phase: "Month 2", focus: "Implement seasonal maintenance reminder system", outcome: "Build recurring revenue from existing customer base" },
            ],
            financial_impact: "With 600 unconverted quotes at an average job value of $1,400, reactivating just 8% generates $67,200 in recovered revenue. Combined with faster quote response and seasonal reminders, total first-year impact could exceed $100,000.",
            service_recommendations: [
              { service: "Dead Lead Revival", priority: "critical", problem_solved: "600 unconverted quotes with no follow-up system", expected_outcome: "8-12% reactivation rate within 30 days", pricing_model: "50% of net profit recovered", why_now: "Busy season is 6 weeks away — recover revenue before competitors do", included: true },
              { service: "AI Speed to Lead", priority: "high", problem_solved: "24-48 hour response time losing jobs to competitors", expected_outcome: "Sub-60-second response time 24/7", pricing_model: "$397/month", why_now: "HVAC is a speed game — first to respond usually wins", included: true },
            ],
          },
          report_ready: true,
          completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]

      const { error: auditsError } = await supabase.from("audits").insert(audits)
      if (auditsError) {
        addLog(`✗ Failed to create audits: ${auditsError.message}`)
      } else {
        addLog("✓ 2 AI audits created — both client submitted with full insights and recommendations")
      }

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
