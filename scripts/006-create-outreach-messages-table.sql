-- Create outreach_messages table
CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE NOT NULL,
  message_text TEXT NOT NULL,
  contact_name TEXT,
  contact_business TEXT,
  status TEXT CHECK (status IN ('draft', 'sent', 'replied', 'no_reply')) DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;

-- RLS policy
DROP POLICY IF EXISTS "Users manage own messages" ON outreach_messages;
CREATE POLICY "Users manage own messages" ON outreach_messages
  FOR ALL USING (auth.uid() = user_id);

-- Update outreach table with batch tracking columns
ALTER TABLE outreach ADD COLUMN IF NOT EXISTS messages_generated BOOLEAN DEFAULT false;
ALTER TABLE outreach ADD COLUMN IF NOT EXISTS messages_generated_at TIMESTAMPTZ;
