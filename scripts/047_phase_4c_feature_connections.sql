-- Phase 4C: feature connections migration.
--
-- The `prospects` and `notifications` tables already exist in the database
-- from an earlier phase (see live schema) — this migration only adds the two
-- columns that the audit/quiz/notification flows need, plus a supporting
-- index for the notification bell dropdown query.

-- 1. Quiz responses need to remember which audit link was generated and sent
--    to the respondent so we can show it in the reply thread + link back
--    from the Clients screen.
alter table quiz_responses
  add column if not exists audit_link_sent text,
  add column if not exists audit_id uuid references audits(id) on delete set null;

-- 2. Audits need a generic metadata bag so we can stamp source info on
--    quiz-generated audits (source = "quiz", quiz_id, quiz_score). The
--    existing `responses` column is reserved for the audit form answers.
alter table audits
  add column if not exists metadata jsonb default '{}'::jsonb;

-- 3. The NotificationBell dropdown fetches the latest 10 notifications for
--    the current user. A (user_id, created_at DESC) index turns that into a
--    single index scan instead of a seq scan + sort.
create index if not exists idx_notifications_user_created
  on notifications (user_id, created_at desc);

-- 4. Demo logs already has prospect_id, but we add an index on
--    (user_id, prospect_id) so the Clients page can efficiently show a
--    prospect's demo history.
create index if not exists idx_demo_logs_user_prospect
  on demo_logs (user_id, prospect_id);
