-- Strip any stored <cite ...>...</cite> tags out of existing Android records.
-- Claude with web_search tooling leaves these citation tags in its outputs and
-- they were being saved verbatim to androids.prompt and to several string
-- fields inside androids.business_context (JSONB).
--
-- We run the same cleanup the API route now applies at generation time against
-- all existing rows so historical Androids stop rendering raw <cite> tags in
-- the demo chat, call prep, etc.
--
-- Safe to rerun: every expression is idempotent (no-op when no tags are left).

-- 1. Clean the prompt column
update androids
set prompt = regexp_replace(prompt, '<cite\b[^>]*/>|<cite\b[^>]*>|</cite>', '', 'gi')
where prompt ~* '<\s*/?\s*cite\b';

-- 2. Clean the string values inside the business_context JSONB. We serialise,
--    strip, and re-parse so every nested string field is covered in one pass.
update androids
set business_context = regexp_replace(
  business_context::text,
  '<cite\b[^>]*/>|<cite\b[^>]*>|</cite>',
  '',
  'gi'
)::jsonb
where business_context::text ~* '<\s*/?\s*cite\b';
