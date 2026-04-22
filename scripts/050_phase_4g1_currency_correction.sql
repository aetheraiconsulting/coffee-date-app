-- Phase 4G.1 — Currency correction + Dead Lead Revival fixed pricing
--
-- Two jobs:
--
-- 1. Sweep any lingering GBP symbols out of the agents table. Migration 048
--    seeded dead-lead-revival with a typical_roi like '£3-8K recovered per
--    1,000 dead leads'. We now standardise on USD across the product, so we
--    do a blunt character replace on every text column that might carry a
--    £ (typical_roi, pricing_notes, performance_notes, one_liner, problem_solved,
--    description). The replacement is idempotent — running twice is harmless
--    because a second run finds no £ symbols.
--
-- 2. Lock Dead Lead Revival at the exact fixed pricing Adam will never
--    change: zero setup, zero monthly, 50% of net profit, with the
--    per-appointment / per-conversation alternatives spelled out in
--    pricing_notes. All other agents' numeric pricing is left alone here —
--    those get re-populated by the new /api/agents/research-pricing admin
--    endpoint which pulls real 2026 benchmarks from Claude.
--
-- Safe to re-run.

-- ========================================================================
-- 1. Currency symbol sweep across agents' text columns.
-- ========================================================================

update agents
set typical_roi = replace(typical_roi, '£', '$')
where typical_roi like '%£%';

update agents
set pricing_notes = replace(pricing_notes, '£', '$')
where pricing_notes like '%£%';

update agents
set performance_notes = replace(performance_notes, '£', '$')
where performance_notes like '%£%';

update agents
set one_liner = replace(one_liner, '£', '$')
where one_liner like '%£%';

update agents
set problem_solved = replace(problem_solved, '£', '$')
where problem_solved like '%£%';

update agents
set description = replace(description, '£', '$')
where description like '%£%';

-- Same sweep across audits text/json columns that operators might have
-- accrued in earlier pilot data.
update audits
set executive_summary = replace(executive_summary, '£', '$')
where executive_summary like '%£%';

-- ========================================================================
-- 2. Dead Lead Revival — locked pricing.
--
-- These exact values are the product's "always true" pricing for the
-- revival service: Adam never sells it differently, so we want the DB to
-- reflect that regardless of what Claude suggests for anything else.
-- ========================================================================

update agents set
  default_pricing_model   = '50_profit_share',
  typical_setup_fee_low   = 0,
  typical_setup_fee_high  = 0,
  typical_monthly_fee_low = 0,
  typical_monthly_fee_high= 0,
  typical_performance_fee = 50,
  performance_fee_basis   = 'net_profit_percentage',
  performance_notes       = '50% of net profit recovered from reactivated leads. Zero upfront cost. Zero monthly retainer.',
  pricing_notes           = 'Alternative model available: $50 per booked appointment, or $25 per qualified conversation.'
where slug = 'dead-lead-revival';
