-- Migration 044: Add demo_secured flag to niche_user_state
-- Separates "demo booked/secured" (a milestone) from "demo completed" (actually run).
-- Non-destructive: uses IF NOT EXISTS.

ALTER TABLE niche_user_state
  ADD COLUMN IF NOT EXISTS demo_secured BOOLEAN DEFAULT false;

ALTER TABLE niche_user_state
  ADD COLUMN IF NOT EXISTS demo_secured_at TIMESTAMPTZ;

-- Backfill: any niche whose coffee date is already completed must have had a demo secured.
UPDATE niche_user_state
SET
  demo_secured = true,
  demo_secured_at = COALESCE(demo_secured_at, coffee_date_completed_at, updated_at, now())
WHERE coffee_date_completed = true
  AND (demo_secured IS NULL OR demo_secured = false);
