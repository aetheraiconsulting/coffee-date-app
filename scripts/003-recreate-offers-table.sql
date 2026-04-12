-- Drop and recreate offers table with new schema for Claude-generated offers
drop table if exists offers;

create table offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  niche text not null,
  service_name text not null,
  outcome_statement text not null,
  price_point text not null,
  guarantee text not null,
  confidence_score text check (confidence_score in ('strong', 'needs_work', 'weak')) not null,
  confidence_reason text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table offers enable row level security;

create policy "Users manage own offers" on offers for all using (auth.uid() = user_id);
