-- Diagnostic: list triggers and check constraints on prospects so we
-- can see what's auto-inserting or blocking our seed.
SELECT
  tgname   AS trigger_name,
  tgrelid::regclass AS table_name,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid IN (
  'public.prospects'::regclass,
  'public.outreach_messages'::regclass,
  'public.reply_threads'::regclass,
  'public.niche_user_state'::regclass,
  'public.offers'::regclass,
  'public.proposals'::regclass
)
AND NOT tgisinternal
ORDER BY table_name, tgname;

-- Also list the prospects check constraints
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.prospects'::regclass;
