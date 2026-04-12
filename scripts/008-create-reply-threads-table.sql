-- Create reply_threads table for storing prospect replies and AI-generated responses
CREATE TABLE IF NOT EXISTS reply_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  outreach_message_id UUID REFERENCES outreach_messages(id) ON DELETE CASCADE NOT NULL,
  prospect_reply TEXT NOT NULL,
  suggested_response TEXT NOT NULL,
  response_goal TEXT,
  response_sent BOOLEAN DEFAULT false,
  response_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE reply_threads ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own reply threads
CREATE POLICY "Users manage own reply threads" ON reply_threads
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookups by outreach message
CREATE INDEX IF NOT EXISTS idx_reply_threads_outreach_message_id ON reply_threads(outreach_message_id);
CREATE INDEX IF NOT EXISTS idx_reply_threads_user_id ON reply_threads(user_id);
