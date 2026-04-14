-- Ensure audit_share_code exists on profiles and auto-generates for new users
-- Also backfill existing users who don't have one

-- Add column if not exists (safe to run multiple times)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS audit_share_code TEXT UNIQUE;

-- Generate share codes for users who don't have one
UPDATE profiles
SET audit_share_code = substr(md5(random()::text || id::text), 1, 12)
WHERE audit_share_code IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_audit_share_code ON profiles(audit_share_code);

-- Create function to auto-generate share code on insert
CREATE OR REPLACE FUNCTION generate_audit_share_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.audit_share_code IS NULL THEN
    NEW.audit_share_code := substr(md5(random()::text || NEW.id::text), 1, 12);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (to allow re-running)
DROP TRIGGER IF EXISTS trigger_generate_audit_share_code ON profiles;

-- Create trigger
CREATE TRIGGER trigger_generate_audit_share_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_audit_share_code();

-- Allow public read of profiles by audit_share_code (for the public audit form)
DROP POLICY IF EXISTS profiles_select_by_audit_share_code ON profiles;
CREATE POLICY profiles_select_by_audit_share_code ON profiles
  FOR SELECT
  USING (audit_share_code IS NOT NULL);
