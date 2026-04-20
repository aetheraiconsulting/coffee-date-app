-- Build 2 — Proposal Won/Lost tracking + GHL client_onboarded separation
-- Note: This migration was executed manually before the code changes were deployed.

-- Add client_onboarded tracking to niche_user_state
alter table niche_user_state
add column if not exists client_onboarded boolean default false,
add column if not exists client_onboarded_at timestamptz;

-- Ensure deal_status values are consistent on proposals
-- Valid values: 'pending' (default), 'won', 'lost'
alter table proposals
alter column deal_status set default 'pending';

-- Backfill any proposals with null deal_status
update proposals
set deal_status = 'pending'
where deal_status is null;

-- Track when the deal outcome was last updated
alter table proposals
add column if not exists deal_updated_at timestamptz;
