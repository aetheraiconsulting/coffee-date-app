-- Diagnostic: show notifications check constraint values
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'notifications'::regclass AND contype = 'c';
