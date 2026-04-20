-- Set database defaults so new profile rows automatically get sprint_start_date and onboarding flag
ALTER TABLE profiles
  ALTER COLUMN sprint_start_date SET DEFAULT now();

ALTER TABLE profiles
  ALTER COLUMN has_completed_onboarding SET DEFAULT false;

-- Backfill sprint_start_date for existing users from their profile creation date
UPDATE profiles
SET sprint_start_date = created_at
WHERE sprint_start_date IS NULL;

-- Mark existing users as having completed onboarding so they do not see the welcome modal
-- Only applies to users who signed up more than 1 day ago (so brand new signups in progress still see the modal)
UPDATE profiles
SET has_completed_onboarding = true
WHERE has_completed_onboarding IS NULL
   OR (has_completed_onboarding = false AND created_at < now() - interval '1 day');
