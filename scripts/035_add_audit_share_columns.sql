-- Add columns for shareable audit links
alter table audits
  add column if not exists share_token uuid default gen_random_uuid(),
  add column if not exists shared_at timestamptz,
  add column if not exists prospect_name text,
  add column if not exists prospect_email text,
  add column if not exists prospect_submitted_at timestamptz,
  add column if not exists draft_responses jsonb,
  add column if not exists teaser_content text;

-- Create index on share_token for fast lookups
create index if not exists audits_share_token_idx on audits(share_token);

-- Allow public access to read audits by share_token (for prospect-facing page)
create policy "audits_public_read_by_token" on audits
  for select
  using (share_token is not null);

-- Allow public updates to specific fields by share_token (for draft saving)
create policy "audits_public_update_by_token" on audits
  for update
  using (share_token is not null)
  with check (share_token is not null);
