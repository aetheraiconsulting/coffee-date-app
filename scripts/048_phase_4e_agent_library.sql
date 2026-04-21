-- Phase 4E — AI Agent Recommendations
-- 1. Add agent/audit attribution columns to androids table so we can track
--    which Androids were built from which agent template or audit.
-- 2. Seed the 8 public agent templates used across the library, audit matching,
--    and the Android builder. Idempotent via ON CONFLICT on slug.

alter table androids
  add column if not exists agent_id uuid references agents(id) on delete set null,
  add column if not exists audit_id uuid references audits(id) on delete set null;

create index if not exists androids_agent_id_idx on androids (agent_id);
create index if not exists androids_audit_id_idx on androids (audit_id);

-- Slug is used by /prompt-generator?agent_slug=... deep links so it must be
-- unique. Add the constraint defensively in case an earlier migration didn't.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agents_slug_key'
  ) then
    alter table agents add constraint agents_slug_key unique (slug);
  end if;
end$$;

insert into agents (
  slug,
  name,
  category,
  problem_solved,
  one_liner,
  description,
  icon,
  typical_roi,
  typical_roi_value,
  setup_time_estimate,
  service_recommendation_keywords,
  fit_niches,
  android_prompt_template,
  is_public,
  sort_order
) values
(
  'dead-lead-revival',
  'Dead Lead Revival Agent',
  'Revenue Recovery',
  'Cold leads sitting in CRM worth nothing',
  'Wakes up old prospects with context-aware SMS, qualifies interest, and books calls.',
  'A conversational agent that takes a list of dormant contacts, personalises the first touch from what we know about them, handles common objections, and drops a booking link when interest is confirmed.',
  'Zap',
  '£3-8K recovered per 1,000 dead leads',
  5000,
  '2-3 days',
  '["dead leads", "lead revival", "cold leads", "reactivation", "dormant", "sms revival", "ghl revival"]'::jsonb,
  '["home services", "coaching", "gyms", "med spa", "dental", "roofing", "legal"]'::jsonb,
  'You are a warm, professional revival agent messaging someone who previously enquired but never converted. Reference their original interest without being creepy. Qualify softly, handle the top 2-3 objections conversationally, and offer a booking link only when they confirm real intent.',
  true,
  10
),
(
  'inbound-qualifier',
  'Inbound Lead Qualifier',
  'Lead Capture',
  'Fresh inbound leads going cold before sales calls them back',
  'Qualifies new enquiries instantly, filters tyre-kickers, books the hot ones straight onto the calendar.',
  'Runs on every new form fill, ad click or DM. Scores fit, captures budget and timeline, and hands sales a pre-qualified booking with full context.',
  'MessageSquare',
  '30-50% increase in booked calls',
  4000,
  '1-2 days',
  '["inbound", "lead qualification", "speed to lead", "new enquiries", "form fills", "ad leads"]'::jsonb,
  '["home services", "agencies", "coaching", "saas", "legal", "financial advisors"]'::jsonb,
  'You are the first touchpoint for a new enquiry. Respond within seconds, warm and concise. Qualify on budget, timeline, and fit using the provided business criteria. Book qualified prospects directly; politely redirect unqualified ones.',
  true,
  20
),
(
  'appointment-setter',
  'Appointment Setter',
  'Booking & Scheduling',
  'Sales team wasting hours chasing people for calendar slots',
  'Handles the full back-and-forth of finding a time, confirms, and sends reminders.',
  'Takes a qualified lead, proposes times from your real calendar, handles reschedules, and fires confirmation + reminder sequences so no-shows plummet.',
  'Calendar',
  '40-60% reduction in no-shows',
  3500,
  '1 day',
  '["appointment setting", "scheduling", "booking", "no-shows", "calendar", "reminders"]'::jsonb,
  '["coaching", "consulting", "agencies", "med spa", "dental", "financial advisors"]'::jsonb,
  'You are an appointment setter for a business. Your only goal is to lock in a confirmed meeting time using the provided calendar. Be efficient, friendly, and always confirm the slot in writing before ending the conversation.',
  true,
  30
),
(
  'review-responder',
  'Review Response Agent',
  'Reputation',
  'Bad reviews left unanswered damaging local search ranking',
  'Drafts on-brand replies to every Google/Trustpilot review within minutes of posting.',
  'Monitors review streams, writes empathetic replies to negatives and grateful replies to positives, and flags anything needing owner attention.',
  'Star',
  '0.3-0.5 star average rating lift',
  2500,
  '2 days',
  '["reviews", "reputation", "google reviews", "review response", "trustpilot", "brand"]'::jsonb,
  '["home services", "restaurants", "med spa", "dental", "gyms", "retail"]'::jsonb,
  'You are a review response agent for a local business. Write replies that sound like the owner — warm, accountable, professional. For negatives, acknowledge then take the conversation offline. For positives, express real gratitude without sounding templated.',
  true,
  40
),
(
  'content-repurposer',
  'Content Repurposer',
  'Marketing',
  'Spending hours reformatting one piece of content across platforms',
  'Turns one long-form asset into a week of posts, emails, and short videos scripts.',
  'Feed it a blog, podcast episode or long video. It outputs LinkedIn posts, an email newsletter, tweet threads, and YouTube Short scripts — all in the brand voice.',
  'FileText',
  '5-10 hours saved per week',
  2000,
  '3 days',
  '["content", "repurpose", "social media", "blog", "podcast", "marketing content"]'::jsonb,
  '["coaching", "consulting", "agencies", "saas", "creators"]'::jsonb,
  'You are a content repurposing agent. Take the source material and output platform-specific versions that match the business voice, keeping the core insight intact while adapting length, hooks, and formatting.',
  true,
  50
),
(
  'sales-followup',
  'Sales Follow-up Agent',
  'Sales Enablement',
  'Deals stalling because no one follows up after proposals',
  'Runs the full follow-up cadence after a proposal is sent — nudges, objection handling, close.',
  'Tracks open/read signals, sends timed follow-ups in the rep''s voice, surfaces objections, and escalates to the human when the prospect shows real buying intent.',
  'Target',
  '20-35% proposal close rate lift',
  4500,
  '2-3 days',
  '["follow up", "proposal follow up", "sales followup", "closing", "stalled deals", "pipeline"]'::jsonb,
  '["agencies", "consulting", "saas", "home services", "legal"]'::jsonb,
  'You are a sales follow-up agent. Your job is to keep a deal warm after the proposal is sent. Follow the provided cadence, handle objections using the scripted responses, and escalate to the human rep the moment real buying intent appears.',
  true,
  60
),
(
  'reactivation-concierge',
  'Client Reactivation Concierge',
  'Revenue Recovery',
  'Past clients who churned or went quiet and are ripe to win back',
  'Reaches out to former clients with tailored win-back offers based on their history.',
  'Segments churned clients by reason for leaving, crafts a bespoke win-back offer, and routes responses to sales or straight into booking depending on intent.',
  'CalendarCheck',
  '10-20% of churned clients reactivated',
  6000,
  '3-4 days',
  '["reactivation", "win back", "churn", "former clients", "past clients", "client retention"]'::jsonb,
  '["saas", "coaching", "agencies", "gyms", "med spa"]'::jsonb,
  'You are a win-back concierge reaching out to a former client. Reference their previous relationship warmly, acknowledge what changed, and present a tailored reason to come back. Never pressure — offer a clear next step only when interest is genuine.',
  true,
  70
),
(
  'support-triage',
  'Support Triage Agent',
  'Customer Service',
  'Support inbox overwhelmed with repetitive questions',
  'Answers tier-1 support instantly, routes tier-2 to the right human, closes tickets fast.',
  'Sits on top of your helpdesk or shared inbox. Resolves FAQs directly, triages everything else with full context, and keeps the customer posted until resolution.',
  'Headphones',
  '60-80% of tier-1 tickets auto-resolved',
  3000,
  '2 days',
  '["support", "customer service", "helpdesk", "tickets", "faq", "support automation"]'::jsonb,
  '["saas", "ecommerce", "agencies", "home services"]'::jsonb,
  'You are a customer support agent. Resolve tier-1 questions using the provided knowledge base. For anything outside scope, gather context and route to the right human team member with a clean summary. Always keep the customer informed.',
  true,
  80
)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  problem_solved = excluded.problem_solved,
  one_liner = excluded.one_liner,
  description = excluded.description,
  icon = excluded.icon,
  typical_roi = excluded.typical_roi,
  typical_roi_value = excluded.typical_roi_value,
  setup_time_estimate = excluded.setup_time_estimate,
  service_recommendation_keywords = excluded.service_recommendation_keywords,
  fit_niches = excluded.fit_niches,
  android_prompt_template = excluded.android_prompt_template,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order;
