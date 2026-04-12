-- Fix outreach_messages status enum and remove unused columns

-- Drop unused columns
ALTER TABLE outreach_messages 
  DROP COLUMN IF EXISTS tone,
  DROP COLUMN IF EXISTS hook_type,
  DROP COLUMN IF EXISTS niche;

-- Fix status enum
ALTER TABLE outreach_messages 
  DROP CONSTRAINT IF EXISTS outreach_messages_status_check;

ALTER TABLE outreach_messages 
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE outreach_messages 
  ALTER COLUMN status TYPE TEXT;

ALTER TABLE outreach_messages
  ADD CONSTRAINT outreach_messages_status_check 
  CHECK (status IN ('draft', 'sent', 'replied', 'no_reply'));

ALTER TABLE outreach_messages
  ALTER COLUMN status SET DEFAULT 'draft';

-- Migrate existing data
UPDATE outreach_messages SET status = 'draft' WHERE status = 'pending';
UPDATE outreach_messages SET status = 'draft' WHERE status = 'skipped';
