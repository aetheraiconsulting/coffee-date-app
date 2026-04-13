-- Add ai_prefilled column to androids table
ALTER TABLE androids 
ADD COLUMN IF NOT EXISTS ai_prefilled BOOLEAN DEFAULT FALSE;
