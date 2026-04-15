-- Add sprint_start_date column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sprint_start_date timestamp with time zone;
