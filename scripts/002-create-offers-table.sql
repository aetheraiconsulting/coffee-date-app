-- Create offers table
create table if not exists offers (
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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table offers enable row level security;

-- Create policy for users to manage their own offers
create policy "Users can manage own offers" on offers
  for all using (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists offers_user_id_idx on offers(user_id);
create index if not exists offers_is_active_idx on offers(user_id, is_active);
