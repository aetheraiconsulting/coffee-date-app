DROP TABLE IF EXISTS offers;

CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  niche TEXT NOT NULL,
  service_name TEXT NOT NULL,
  outcome_statement TEXT NOT NULL,
  price_point TEXT NOT NULL,
  guarantee TEXT NOT NULL,
  confidence_score TEXT CHECK (confidence_score IN ('strong', 'needs_work', 'weak')) NOT NULL,
  confidence_reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own offers" ON offers FOR ALL USING (auth.uid() = user_id);
