-- Add quiz_share_code to profiles for permanent quiz links
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS quiz_share_code text UNIQUE;

-- Generate codes for existing users who don't have one
UPDATE profiles
SET quiz_share_code = substring(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE quiz_share_code IS NULL;

-- Ensure default quiz flag on quiz_templates
ALTER TABLE quiz_templates
ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;

-- Add Claude-generated results field to quiz_responses
ALTER TABLE quiz_responses
ADD COLUMN IF NOT EXISTS claude_results_message text;

-- Create trigger to auto-generate quiz_share_code for new profiles
CREATE OR REPLACE FUNCTION generate_quiz_share_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quiz_share_code IS NULL THEN
    NEW.quiz_share_code := substring(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_quiz_share_code ON profiles;
CREATE TRIGGER trigger_generate_quiz_share_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_quiz_share_code();
