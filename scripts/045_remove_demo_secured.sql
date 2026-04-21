-- Remove the manual demo_secured columns as demo completion is now fully automatic.
-- The existing coffee_date_completed flag (set when a user runs the demo in presentation
-- mode) is the single source of truth for whether a Coffee Date Demo has happened.
alter table niche_user_state
  drop column if exists demo_secured,
  drop column if exists demo_secured_at;
