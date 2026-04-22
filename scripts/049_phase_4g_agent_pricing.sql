-- Phase 4G — Agent Pricing + AI-suggested audit pricing
--
-- 1. Add structured pricing fields to the `agents` table so each agent
--    template can carry default pricing the Audit's Claude prompt can
--    match against, and the Agent Library card can display.
-- 2. Add `pricing_suggestions` jsonb to `audits` so customised per-rec
--    pricing set by the operator persists alongside the AI-generated
--    suggestions inside ai_insights.
-- 3. Populate pricing for both (a) the spec's reference slugs and
--    (b) the slugs we actually seeded in Phase 4E (migration 048).
--    Non-matching slugs are no-ops — `update ... where slug = ...`
--    simply doesn't touch rows that don't exist.

alter table agents
  add column if not exists default_pricing_model text,
  add column if not exists typical_setup_fee_low integer,
  add column if not exists typical_setup_fee_high integer,
  add column if not exists typical_monthly_fee_low integer,
  add column if not exists typical_monthly_fee_high integer,
  add column if not exists typical_performance_fee integer,
  add column if not exists performance_fee_basis text,
  add column if not exists performance_notes text,
  add column if not exists pricing_notes text;

alter table audits
  add column if not exists pricing_suggestions jsonb default '{}'::jsonb;

-- ========================================================================
-- Pricing values for slugs from the original spec. Safe to run — if these
-- slugs don't exist they simply update zero rows.
-- ========================================================================

update agents set
  default_pricing_model = '50_profit_share',
  typical_performance_fee = 50,
  performance_fee_basis = 'net_profit_percentage',
  performance_notes = '50% of net profit recovered from reactivated leads. Zero setup. Zero monthly retainer. You only earn when the client earns.',
  pricing_notes = 'Alternative: $50 per booked appointment if client prefers a per-lead model.'
where slug = 'dead-lead-revival';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 1500,
  typical_setup_fee_high = 3000,
  typical_monthly_fee_low = 400,
  typical_monthly_fee_high = 800,
  pricing_notes = 'Setup covers FAQ knowledge base build, chatbot training, and website integration. Monthly covers ongoing tuning and knowledge updates.'
where slug = 'ai-faq-bot';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 800,
  typical_setup_fee_high = 1500,
  typical_monthly_fee_low = 250,
  typical_monthly_fee_high = 500,
  pricing_notes = 'Setup covers calendar integration and reminder template customisation. Monthly includes SMS allowance up to 500 reminders.'
where slug = 'appointment-reminder';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 500,
  typical_setup_fee_high = 1000,
  typical_monthly_fee_low = 150,
  typical_monthly_fee_high = 300,
  pricing_notes = 'Setup covers review flow design and integration. Monthly includes unlimited review requests.'
where slug = 'review-collector';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 1500,
  typical_setup_fee_high = 3000,
  typical_monthly_fee_low = 500,
  typical_monthly_fee_high = 1000,
  performance_notes = 'Alternative: pay-per-recovered-deal at 10-15% of recovered deal value.',
  pricing_notes = 'Setup includes quote follow-up sequence build and CRM integration.'
where slug = 'quote-follow-up';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 2000,
  typical_setup_fee_high = 4000,
  typical_monthly_fee_low = 500,
  typical_monthly_fee_high = 1200,
  performance_notes = 'Alternative: $25-50 per qualified lead delivered to sales team.',
  pricing_notes = 'Setup includes qualification flow design and lead routing logic.'
where slug = 'lead-qualifier';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 2000,
  typical_setup_fee_high = 4000,
  typical_monthly_fee_low = 500,
  typical_monthly_fee_high = 1000,
  pricing_notes = 'Setup covers calendar integration, booking flow, and business hours configuration.'
where slug = 'appointment-booker';

update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 3000,
  typical_setup_fee_high = 6000,
  typical_monthly_fee_low = 800,
  typical_monthly_fee_high = 2000,
  pricing_notes = 'Setup covers knowledge base build, ticket routing logic, and escalation flow. Monthly scales with conversation volume.'
where slug = 'customer-support';

-- ========================================================================
-- Pricing for the slugs we actually seeded in migration 048. Mapping is by
-- conceptual closest fit to the spec's reference agents.
-- ========================================================================

-- reactivation-concierge is a second profit-share agent (win-back flow)
update agents set
  default_pricing_model = '50_profit_share',
  typical_performance_fee = 50,
  performance_fee_basis = 'net_profit_percentage',
  performance_notes = '50% of net profit recovered from reactivated former clients. Zero setup. Zero monthly retainer.',
  pricing_notes = 'Alternative: flat win-back fee of $100-$250 per reactivated client for non-subscription businesses.'
where slug = 'reactivation-concierge';

-- inbound-qualifier ≈ spec's lead-qualifier (retainer + per-lead alternative)
update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 2000,
  typical_setup_fee_high = 4000,
  typical_monthly_fee_low = 500,
  typical_monthly_fee_high = 1200,
  performance_notes = 'Alternative: $25-50 per qualified lead delivered to sales team.',
  pricing_notes = 'Setup includes qualification flow design and lead routing logic.'
where slug = 'inbound-qualifier';

-- appointment-setter ≈ spec's appointment-booker (full booking flow, not just reminders)
update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 2000,
  typical_setup_fee_high = 4000,
  typical_monthly_fee_low = 500,
  typical_monthly_fee_high = 1000,
  pricing_notes = 'Setup covers calendar integration, booking flow, reminders, and business hours configuration.'
where slug = 'appointment-setter';

-- review-responder ≈ spec's review-collector
update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 500,
  typical_setup_fee_high = 1000,
  typical_monthly_fee_low = 150,
  typical_monthly_fee_high = 300,
  pricing_notes = 'Setup covers review response templates and monitoring integration. Monthly includes unlimited review replies.'
where slug = 'review-responder';

-- content-repurposer: retainer in the low-mid range (similar to ai-faq-bot positioning)
update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 1500,
  typical_setup_fee_high = 3000,
  typical_monthly_fee_low = 400,
  typical_monthly_fee_high = 800,
  pricing_notes = 'Setup covers brand voice training and source-format templates. Monthly covers 4-8 pieces of source content repurposed across channels.'
where slug = 'content-repurposer';

-- sales-followup ≈ spec's quote-follow-up
update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 1500,
  typical_setup_fee_high = 3000,
  typical_monthly_fee_low = 500,
  typical_monthly_fee_high = 1000,
  performance_notes = 'Alternative: pay-per-recovered-deal at 10-15% of recovered deal value.',
  pricing_notes = 'Setup includes follow-up sequence build, objection scripts, and CRM integration.'
where slug = 'sales-followup';

-- support-triage ≈ spec's customer-support
update agents set
  default_pricing_model = 'retainer',
  typical_setup_fee_low = 3000,
  typical_setup_fee_high = 6000,
  typical_monthly_fee_low = 800,
  typical_monthly_fee_high = 2000,
  pricing_notes = 'Setup covers knowledge base build, ticket routing logic, and escalation flow. Monthly scales with conversation volume.'
where slug = 'support-triage';
