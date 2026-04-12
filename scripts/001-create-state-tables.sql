-- Migration: Create tables for user state tracking
-- Feature 01: getUserState()

-- Add niche_id and offer_id to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS niche_id uuid REFERENCES niches(id),
ADD COLUMN IF NOT EXISTS offer_id uuid;

-- Create outreach table
CREATE TABLE IF NOT EXISTS outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started boolean DEFAULT false,
  total_sent integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  first_sent_at timestamp with time zone
);

-- Create replies table
CREATE TABLE IF NOT EXISTS replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid,
  received_at timestamp with time zone DEFAULT now()
);

-- Create calls table
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booked boolean DEFAULT false,
  completed boolean DEFAULT false,
  scheduled_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent boolean DEFAULT false,
  sent_at timestamp with time zone,
  deal_status text
);

-- Enable RLS on all new tables
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outreach
CREATE POLICY "outreach_select_own" ON outreach FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "outreach_insert_own" ON outreach FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "outreach_update_own" ON outreach FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "outreach_delete_own" ON outreach FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for replies
CREATE POLICY "replies_select_own" ON replies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "replies_insert_own" ON replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "replies_update_own" ON replies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "replies_delete_own" ON replies FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for calls
CREATE POLICY "calls_select_own" ON calls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "calls_insert_own" ON calls FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "calls_update_own" ON calls FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "calls_delete_own" ON calls FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for proposals
CREATE POLICY "proposals_select_own" ON proposals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "proposals_insert_own" ON proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "proposals_update_own" ON proposals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "proposals_delete_own" ON proposals FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_outreach_user_id ON outreach(user_id);
CREATE INDEX IF NOT EXISTS idx_replies_user_id ON replies(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_proposals_user_id ON proposals(user_id);
