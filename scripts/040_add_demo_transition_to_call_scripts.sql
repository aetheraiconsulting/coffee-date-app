-- Add demo_transition column to call_scripts table
ALTER TABLE call_scripts ADD COLUMN IF NOT EXISTS demo_transition text;
