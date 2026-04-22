-- ============================================================================
-- Migration 051 — Admin accounts + day-15 test-data seed
-- ============================================================================
--
-- Goal: the 3 aetheraiconsulting.org team addresses
--   - hello@aetheraiconsulting.org
--   - anjal@aetheraiconsulting.org
--   - adam@aetheraiconsulting.org
-- get full access to the app without needing to pay, and are seeded with
-- realistic test data so they land on the app as if they were 15 days into
-- their trial sprint.
--
-- Access model
-- ------------
-- We don't introduce a new `is_admin` column — the codebase already gates on
-- `profiles.subscription_status`. We repurpose that column by allowing a new
-- value `'admin'` which the app code (checkAccess.ts, getUserState.ts,
-- support-request-modal.tsx) treats as full access, bypassing the paywall
-- exactly like `'active'` / `'student'` already do.
--
-- How it works
-- ------------
-- 1. A BEFORE INSERT OR UPDATE trigger on `profiles` auto-promotes any row
--    whose email matches the admin allowlist. This means that if an admin
--    signs up LATER (after this migration runs), the next write to their
--    profile row flips them to `subscription_status = 'admin'` automatically
--    without any manual intervention.
-- 2. A seed function `seed_admin_test_data(p_user_id, p_email)` populates
--    the user's account with the kind of data a 15-day-in operator would
--    have accumulated: one offer, a handful of favourited niches with
--    varying progress, outreach messages, replies, a completed call, a
--    pending proposal, one won deal, and one onboarded client.
-- 3. A one-shot DO block at the bottom finds any auth.users rows whose
--    email matches the allowlist and runs the seed against them — so admins
--    who have already signed up before this migration runs get their data
--    immediately. Re-running this migration is safe: the seed uses
--    ON CONFLICT DO NOTHING / targeted WHERE NOT EXISTS guards so it won't
--    duplicate or overwrite anything the operator has since created or
--    edited.
--
-- Re-running after a new admin signs up
-- -------------------------------------
-- If one of the 3 admin emails signs up AFTER this migration has been run,
-- their subscription_status will be flipped by the trigger on profile
-- insert, but their seed data won't exist yet. Just re-run this migration
-- (or the seed section of it) and the DO block will seed the new user.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auto-promote trigger
-- ---------------------------------------------------------------------------
-- Fires on both INSERT and UPDATE so that the first time the profile for an
-- admin email is written — regardless of how — the admin fields are set.
-- The list of admin emails is hardcoded here (kept in sync with the
-- hardcoded allowlist in app/api/agents/research-pricing/route.ts and
-- app/(app)/admin/agent-pricing/page.tsx).

CREATE OR REPLACE FUNCTION public.auto_promote_admin_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IN (
    'hello@aetheraiconsulting.org',
    'anjal@aetheraiconsulting.org',
    'adam@aetheraiconsulting.org'
  ) THEN
    -- Subscription bypass: 'admin' is treated as full access by the app.
    NEW.subscription_status := 'admin';

    -- Anchor them at day 15 of the sprint so the UI dropdowns for mission
    -- control, stalls, and onboarding show realistic "growth mode" state.
    IF NEW.sprint_start_date IS NULL THEN
      NEW.sprint_start_date := NOW() - INTERVAL '15 days';
    END IF;

    -- Trial technically ended 1 day ago (day 14 + 1). Admin bypass means
    -- this never actually gates anything, but it keeps the numbers
    -- consistent with a real "day 15" account.
    IF NEW.trial_ends_at IS NULL THEN
      NEW.trial_ends_at := NOW() - INTERVAL '1 day';
    END IF;

    -- Skip onboarding — admins don't need the first-run flow.
    NEW.has_completed_onboarding := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_promote_admin_profile_trigger ON public.profiles;
CREATE TRIGGER auto_promote_admin_profile_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_promote_admin_profile();

-- ---------------------------------------------------------------------------
-- 2. Seed function — day-15 test data
-- ---------------------------------------------------------------------------
-- Populates one admin user's account with the kind of data they'd have
-- accumulated if they had been using the product for 15 days. Every INSERT
-- is idempotent (uses NOT EXISTS or ON CONFLICT) so re-running this function
-- against the same user is safe and won't create duplicates.

CREATE OR REPLACE FUNCTION public.seed_admin_test_data(p_user_id UUID, p_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer_id        UUID;
  v_niche_a         UUID;  -- Primary favourited niche, won deal
  v_niche_b         UUID;  -- Secondary favourite, proposal pending
  v_niche_c         UUID;  -- Early-stage favourite, outreach only
  v_niche_d         UUID;  -- Exploratory, no favourite
  v_prospect_a      UUID;
  v_prospect_b      UUID;
  v_prospect_c      UUID;
  v_proposal_id     UUID;
  v_call_script_id  UUID;
  v_audit_id        UUID;
  v_sprint_start    TIMESTAMPTZ := NOW() - INTERVAL '15 days';
  v_full_name       TEXT;
BEGIN
  -- Pick a readable display name from the email local-part.
  v_full_name := INITCAP(SPLIT_PART(p_email, '@', 1));

  -- Pick 4 distinct niches to use as the admin's working set. If the niches
  -- table doesn't yet have 4 rows this will leave some nulls and the seed
  -- will skip those blocks — still safe.
  SELECT id INTO v_niche_a FROM niches ORDER BY default_priority NULLS LAST, niche_name LIMIT 1;
  SELECT id INTO v_niche_b FROM niches WHERE id <> v_niche_a ORDER BY default_priority NULLS LAST, niche_name LIMIT 1;
  SELECT id INTO v_niche_c FROM niches WHERE id NOT IN (v_niche_a, v_niche_b) ORDER BY default_priority NULLS LAST, niche_name LIMIT 1;
  SELECT id INTO v_niche_d FROM niches WHERE id NOT IN (v_niche_a, v_niche_b, v_niche_c) ORDER BY default_priority NULLS LAST, niche_name LIMIT 1;

  -- ------------------------------------------------------------------
  -- Profile — upsert admin fields. If a row already exists (e.g. the
  -- signup trigger already created it) the trigger above will ensure
  -- the admin fields are correct on update.
  -- ------------------------------------------------------------------
  INSERT INTO profiles (
    id, email, full_name, subscription_status,
    sprint_start_date, trial_ends_at, has_completed_onboarding, created_at, updated_at
  ) VALUES (
    p_user_id, p_email, v_full_name, 'admin',
    v_sprint_start, NOW() - INTERVAL '1 day', TRUE, v_sprint_start, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    subscription_status = 'admin',
    sprint_start_date = COALESCE(profiles.sprint_start_date, EXCLUDED.sprint_start_date),
    trial_ends_at = COALESCE(profiles.trial_ends_at, EXCLUDED.trial_ends_at),
    has_completed_onboarding = TRUE,
    updated_at = NOW();

  -- ------------------------------------------------------------------
  -- User branding — single row, never recreate if it exists.
  -- ------------------------------------------------------------------
  INSERT INTO user_branding (user_id, company_name, brand_colour, calendar_link, created_at, updated_at)
  SELECT p_user_id, 'Aether Consulting', '#00AAFF', 'https://cal.com/aether/discovery', v_sprint_start, NOW()
  WHERE NOT EXISTS (SELECT 1 FROM user_branding WHERE user_id = p_user_id);

  -- ------------------------------------------------------------------
  -- Offer — one active offer created on day 2 of the sprint.
  -- ------------------------------------------------------------------
  SELECT id INTO v_offer_id FROM offers WHERE user_id = p_user_id ORDER BY created_at LIMIT 1;

  IF v_offer_id IS NULL THEN
    INSERT INTO offers (
      user_id, niche, service_name, outcome_statement, pricing_model, price_point,
      guarantee, confidence_score, confidence_reason, is_active, created_at
    ) VALUES (
      p_user_id,
      'Med Spas',
      'Dead Lead Revival',
      'Recover $8K-$20K in booked revenue from your existing unconverted lead database in the first 30 days',
      '50_profit_share',
      '50% of net profit, zero setup, zero monthly',
      'If we don''t recover at least $5K in booked revenue in 30 days, you pay nothing',
      'strong',
      'Fixed structure validated across 40+ med spa deployments',
      TRUE,
      v_sprint_start + INTERVAL '2 days'
    )
    RETURNING id INTO v_offer_id;
  END IF;

  -- Attach the offer to the profile so downstream code treats the user
  -- as having passed the "no_offer" mission state.
  UPDATE profiles SET offer_id = v_offer_id WHERE id = p_user_id AND offer_id IS NULL;

  -- ------------------------------------------------------------------
  -- niche_user_state — 4 rows with varied progression stages
  -- ------------------------------------------------------------------

  -- Niche A: won deal + client onboarded (the "success story")
  IF v_niche_a IS NOT NULL THEN
    INSERT INTO niche_user_state (
      user_id, niche_id, is_favourite, stage, status,
      aov_input, database_size_input, aov_calculator_completed,
      customer_profile_generated, messaging_prepared,
      outreach_generated, outreach_generated_at,
      outreach_start_date, outreach_messages_sent,
      demo_script_created, coffee_date_completed,
      audit_available, android_built, ghl_connected,
      client_onboarded, client_onboarded_at,
      win_completed, win_completed_at, win_type,
      active_monthly_retainer, monthly_profit_split,
      expected_monthly_value, target_monthly_recurring,
      research_notes_added, outreach_complete, outreach_complete_at,
      offer_id, created_at, updated_at
    ) VALUES (
      p_user_id, v_niche_a, TRUE, 'revival', 'Win',
      450, 2400, TRUE, TRUE, TRUE,
      TRUE, v_sprint_start + INTERVAL '3 days',
      v_sprint_start + INTERVAL '3 days', 12,
      TRUE, TRUE, TRUE, TRUE, TRUE,
      TRUE, v_sprint_start + INTERVAL '13 days',
      TRUE, v_sprint_start + INTERVAL '12 days', 'revival',
      2000, 1500, 3500, 5000,
      TRUE, TRUE, v_sprint_start + INTERVAL '10 days',
      v_offer_id, v_sprint_start + INTERVAL '1 day', NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Niche B: proposal sent, waiting on close
  IF v_niche_b IS NOT NULL THEN
    INSERT INTO niche_user_state (
      user_id, niche_id, is_favourite, stage, status,
      aov_input, database_size_input, aov_calculator_completed,
      customer_profile_generated, messaging_prepared,
      outreach_generated, outreach_generated_at,
      outreach_start_date, outreach_messages_sent,
      demo_script_created, coffee_date_completed,
      expected_monthly_value, target_monthly_recurring,
      research_notes_added,
      offer_id, created_at, updated_at
    ) VALUES (
      p_user_id, v_niche_b, TRUE, 'demo', 'Coffee Date Demo',
      250, 1800, TRUE, TRUE, TRUE,
      TRUE, v_sprint_start + INTERVAL '5 days',
      v_sprint_start + INTERVAL '5 days', 8,
      TRUE, TRUE,
      2200, 4000,
      TRUE,
      v_offer_id, v_sprint_start + INTERVAL '3 days', NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Niche C: outreach started, replies trickling in
  IF v_niche_c IS NOT NULL THEN
    INSERT INTO niche_user_state (
      user_id, niche_id, is_favourite, stage, status,
      aov_input, database_size_input, aov_calculator_completed,
      customer_profile_generated, messaging_prepared,
      outreach_generated, outreach_generated_at,
      outreach_start_date, outreach_messages_sent,
      expected_monthly_value,
      research_notes_added,
      offer_id, created_at, updated_at
    ) VALUES (
      p_user_id, v_niche_c, TRUE, 'outreach', 'Outreach in Progress',
      180, 1500, TRUE, TRUE, TRUE,
      TRUE, v_sprint_start + INTERVAL '8 days',
      v_sprint_start + INTERVAL '8 days', 6,
      1800,
      TRUE,
      v_offer_id, v_sprint_start + INTERVAL '6 days', NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Niche D: exploratory, no favourite yet (shows Mission Control how
  -- non-favourited niches render for a mid-sprint user)
  IF v_niche_d IS NOT NULL THEN
    INSERT INTO niche_user_state (
      user_id, niche_id, is_favourite, stage, status,
      research_notes_added,
      created_at, updated_at
    ) VALUES (
      p_user_id, v_niche_d, FALSE, 'outreach', 'Outreach in Progress',
      FALSE,
      v_sprint_start + INTERVAL '11 days', NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- ------------------------------------------------------------------
  -- Prospects (used by call_scripts, proposals, reply_threads)
  -- ------------------------------------------------------------------
  -- Prospects: source must be one of 'audit','quiz','manual','demo','import'
  -- current_stage must be one of 'new','contacted','replied','demo_booked','demo_completed','proposal_sent','won','lost'
  SELECT id INTO v_prospect_a FROM prospects WHERE user_id = p_user_id AND email = 'sarah@glowmedspa.com';
  IF v_prospect_a IS NULL THEN
    INSERT INTO prospects (
      user_id, name, business, email, niche, source, current_stage,
      score, first_contact_at, last_activity_at, created_at, updated_at
    ) VALUES (
      p_user_id, 'Sarah Chen', 'Glow Med Spa', 'sarah@glowmedspa.com',
      'Med Spas', 'audit', 'won',
      95, v_sprint_start + INTERVAL '4 days', v_sprint_start + INTERVAL '13 days',
      v_sprint_start + INTERVAL '4 days', NOW()
    )
    RETURNING id INTO v_prospect_a;
  END IF;

  SELECT id INTO v_prospect_b FROM prospects WHERE user_id = p_user_id AND email = 'mike@peakfitness.com';
  IF v_prospect_b IS NULL THEN
    INSERT INTO prospects (
      user_id, name, business, email, niche, source, current_stage,
      score, first_contact_at, last_activity_at, created_at, updated_at
    ) VALUES (
      p_user_id, 'Mike Rodriguez', 'Peak Fitness Studio', 'mike@peakfitness.com',
      'Fitness Studios', 'demo', 'demo_completed',
      78, v_sprint_start + INTERVAL '6 days', v_sprint_start + INTERVAL '11 days',
      v_sprint_start + INTERVAL '6 days', NOW()
    )
    RETURNING id INTO v_prospect_b;
  END IF;

  SELECT id INTO v_prospect_c FROM prospects WHERE user_id = p_user_id AND email = 'jessica@bridalstudio.com';
  IF v_prospect_c IS NULL THEN
    INSERT INTO prospects (
      user_id, name, business, email, niche, source, current_stage,
      score, first_contact_at, last_activity_at, created_at, updated_at
    ) VALUES (
      p_user_id, 'Jessica Miller', 'Radiant Bridal Studio', 'jessica@bridalstudio.com',
      'Wedding Services', 'manual', 'replied',
      65, v_sprint_start + INTERVAL '9 days', v_sprint_start + INTERVAL '10 days',
      v_sprint_start + INTERVAL '9 days', NOW()
    )
    RETURNING id INTO v_prospect_c;
  END IF;

  -- ------------------------------------------------------------------
  -- Outreach messages — 10 sent, mix of statuses. We insert them one
  -- by one for the "replied" ones so we can capture their IDs for the
  -- reply_threads FK.
  -- ------------------------------------------------------------------
  DECLARE
    v_msg_sarah UUID;
    v_msg_mike UUID;
    v_msg_jessica UUID;
  BEGIN
    -- Sarah's outreach message (replied)
    SELECT id INTO v_msg_sarah FROM outreach_messages WHERE user_id = p_user_id AND contact_name = 'Sarah Chen';
    IF v_msg_sarah IS NULL THEN
      INSERT INTO outreach_messages (user_id, offer_id, contact_name, contact_business, channel, status, subject_line, message_text, sent_at, created_at)
      VALUES (p_user_id, v_offer_id, 'Sarah Chen', 'Glow Med Spa', 'email', 'replied', 'Quick question about Glow Med Spa''s lead follow-up', 'Hey Sarah — noticed Glow Med Spa has been running paid ads for 6+ months but your Google reviews mention leads not hearing back...', v_sprint_start + INTERVAL '4 days', v_sprint_start + INTERVAL '4 days')
      RETURNING id INTO v_msg_sarah;
    END IF;

    -- Mike's outreach message (replied)
    SELECT id INTO v_msg_mike FROM outreach_messages WHERE user_id = p_user_id AND contact_name = 'Mike Rodriguez';
    IF v_msg_mike IS NULL THEN
      INSERT INTO outreach_messages (user_id, offer_id, contact_name, contact_business, channel, status, subject_line, message_text, sent_at, created_at)
      VALUES (p_user_id, v_offer_id, 'Mike Rodriguez', 'Peak Fitness Studio', 'email', 'replied', 'Peak Fitness — recovering your old leads', 'Hi Mike, saw Peak Fitness is doing well on IG but noticed your old lead database is probably sitting untouched...', v_sprint_start + INTERVAL '6 days', v_sprint_start + INTERVAL '6 days')
      RETURNING id INTO v_msg_mike;
    END IF;

    -- Jessica's outreach message (replied)
    SELECT id INTO v_msg_jessica FROM outreach_messages WHERE user_id = p_user_id AND contact_name = 'Jessica Miller';
    IF v_msg_jessica IS NULL THEN
      INSERT INTO outreach_messages (user_id, offer_id, contact_name, contact_business, channel, status, subject_line, message_text, sent_at, created_at)
      VALUES (p_user_id, v_offer_id, 'Jessica Miller', 'Radiant Bridal Studio', 'email', 'replied', 'Bridal season recovery idea', 'Hey Jessica — bridal businesses have this weird problem where 70% of inquiries ghost after the first email...', v_sprint_start + INTERVAL '9 days', v_sprint_start + INTERVAL '9 days')
      RETURNING id INTO v_msg_jessica;
    END IF;

    -- Rest of the outreach messages (sent, no reply)
    IF NOT EXISTS (SELECT 1 FROM outreach_messages WHERE user_id = p_user_id AND contact_name = 'Dan Park') THEN
      INSERT INTO outreach_messages (user_id, offer_id, contact_name, contact_business, channel, status, subject_line, message_text, sent_at, created_at)
      VALUES
        (p_user_id, v_offer_id, 'Dan Park', 'Elevate Med Spa', 'email', 'sent', 'Elevate Med Spa — unconverted leads', 'Dan — your med spa has been growing fast this year but my guess is you have $15K-$40K sitting in your unconverted lead database...', v_sprint_start + INTERVAL '5 days', v_sprint_start + INTERVAL '5 days'),
        (p_user_id, v_offer_id, 'Rachel Green', 'Pure Pilates', 'email', 'sent', 'Pure Pilates — old leads revival', 'Hi Rachel, Pure Pilates looks great. Quick question...', v_sprint_start + INTERVAL '7 days', v_sprint_start + INTERVAL '7 days'),
        (p_user_id, v_offer_id, 'Tom Harris', 'Aesthetic MD', 'email', 'sent', 'Aesthetic MD — revenue from your CRM', 'Tom — how many unconverted leads are sitting in your CRM right now?', v_sprint_start + INTERVAL '7 days', v_sprint_start + INTERVAL '7 days'),
        (p_user_id, v_offer_id, 'Amanda White', 'Studio F Wellness', 'email', 'sent', 'Studio F — recovering booked revenue', 'Amanda — noticed Studio F has been consistent on content for a while...', v_sprint_start + INTERVAL '8 days', v_sprint_start + INTERVAL '8 days'),
        (p_user_id, v_offer_id, 'Brian Lee', 'Zen Med Aesthetics', 'email', 'sent', 'Zen Med — dead leads to revenue', 'Brian, a lot of med spas are sitting on lead lists of 2,000+ that never got worked properly...', v_sprint_start + INTERVAL '10 days', v_sprint_start + INTERVAL '10 days'),
        (p_user_id, v_offer_id, 'Priya Nair', 'Lotus Bridal', 'email', 'sent', 'Lotus — bridal lead follow-up', 'Hi Priya — bridal businesses have inquiry-to-booking gap that costs real money...', v_sprint_start + INTERVAL '11 days', v_sprint_start + INTERVAL '11 days'),
        (p_user_id, v_offer_id, 'Kevin Chen', 'Apex Fit', 'email', 'sent', 'Apex Fit — inactive member re-engagement', 'Kevin, Apex Fit has active members but probably also a bunch of members who stopped showing up...', v_sprint_start + INTERVAL '12 days', v_sprint_start + INTERVAL '12 days');
    END IF;

    -- Link outreach aggregate row
    INSERT INTO outreach (user_id, started, messages_generated, messages_generated_at, total_sent, first_sent_at, created_at)
    SELECT p_user_id, TRUE, TRUE, v_sprint_start + INTERVAL '3 days', 10, v_sprint_start + INTERVAL '4 days', v_sprint_start + INTERVAL '3 days'
    WHERE NOT EXISTS (SELECT 1 FROM outreach WHERE user_id = p_user_id);

    -- ------------------------------------------------------------------
    -- Reply threads — 3 prospects replied. Each links to its outreach_message_id.
    -- ------------------------------------------------------------------
    IF NOT EXISTS (SELECT 1 FROM reply_threads WHERE user_id = p_user_id AND outreach_message_id = v_msg_sarah) THEN
      INSERT INTO reply_threads (user_id, outreach_message_id, prospect_reply, response_goal, suggested_response, response_sent, created_at)
      VALUES (p_user_id, v_msg_sarah, 'Interesting — how does this actually work? Do we have to change anything in our GHL setup?', 'book_call', 'Great question. The whole thing runs alongside your current GHL setup, nothing changes for your team...', TRUE, v_sprint_start + INTERVAL '5 days');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reply_threads WHERE user_id = p_user_id AND outreach_message_id = v_msg_mike) THEN
      INSERT INTO reply_threads (user_id, outreach_message_id, prospect_reply, response_goal, suggested_response, response_sent, created_at)
      VALUES (p_user_id, v_msg_mike, 'We''re pretty swamped right now but tell me more about pricing', 'book_call', 'Totally understand. I''ll keep this short — we run on pure profit split so there''s zero risk to you...', TRUE, v_sprint_start + INTERVAL '7 days');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM reply_threads WHERE user_id = p_user_id AND outreach_message_id = v_msg_jessica) THEN
      INSERT INTO reply_threads (user_id, outreach_message_id, prospect_reply, response_goal, suggested_response, response_sent, created_at)
      VALUES (p_user_id, v_msg_jessica, 'What''s the catch? Sounds too good to be true.', 'book_call', 'Fair question. The "catch" is that it only works if you''ve got a decent-sized lead database already...', FALSE, v_sprint_start + INTERVAL '10 days');
    END IF;
  END;

  -- ------------------------------------------------------------------
  -- Call scripts — 2 created, 1 completed, 1 pending
  -- ------------------------------------------------------------------
  SELECT id INTO v_call_script_id FROM call_scripts WHERE user_id = p_user_id AND prospect_id = v_prospect_a;
  IF v_call_script_id IS NULL THEN
    INSERT INTO call_scripts (
      user_id, prospect_id, offer_id, opening, qualification_questions,
      demo_transition, objection_responses, close_ask, call_notes,
      call_completed, call_completed_at, created_at
    ) VALUES (
      p_user_id, v_prospect_a, v_offer_id,
      'Hey Sarah, thanks for making time. Before we dive in — how''s the lead volume looking for Glow right now?',
      'Roughly how many leads come through monthly? How many convert to consults? Where do the rest tend to drop off?',
      'What I''d love to show you is exactly how we''d work Glow''s unconverted leads — want me to pull up a quick demo?',
      'If they push back on 50/50 split: "The reason we do pure profit share is so there''s zero risk on your side..."',
      'Based on what you''ve shared, this is a clean fit. Can we set up the Android this week and start running it against your last 90 days of unconverted leads?',
      'Great call — Sarah is aligned on the 50/50 split, excited to start. Agreed to kickoff Monday.',
      TRUE, v_sprint_start + INTERVAL '11 days', v_sprint_start + INTERVAL '10 days'
    )
    RETURNING id INTO v_call_script_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM call_scripts WHERE user_id = p_user_id AND prospect_id = v_prospect_b) THEN
    INSERT INTO call_scripts (
      user_id, prospect_id, offer_id, opening, qualification_questions,
      demo_transition, objection_responses, close_ask,
      call_completed, call_completed_at, created_at
    ) VALUES (
      p_user_id, v_prospect_b, v_offer_id,
      'Hey Mike — appreciate you jumping on. Before we get into it, what made you open my email out of the dozens you probably get?',
      'How big is Peak''s current lead database? What does your current follow-up process look like for cold leads?',
      'Let me walk you through what this would actually look like for Peak — I''ve got a quick demo ready.',
      'If they say they already have someone doing this: "Totally fair — what''s their conversion rate on reactivation campaigns?"',
      'Want me to send over a proposal with exact numbers tonight?',
      TRUE, v_sprint_start + INTERVAL '9 days', v_sprint_start + INTERVAL '8 days'
    );
  END IF;

  -- ------------------------------------------------------------------
  -- Proposals — 1 sent + pending for Mike, 1 won for Sarah
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM proposals WHERE user_id = p_user_id AND prospect_id = v_prospect_b) THEN
    INSERT INTO proposals (
      user_id, prospect_id, offer_id, call_script_id,
      prospect_business, prospect_name,
      problem_summary, solution_summary, deliverables, investment, guarantee, next_step,
      confidence_score, confidence_reason,
      sent, sent_at, deal_status, created_at
    ) VALUES (
      p_user_id, v_prospect_b, v_offer_id, NULL,
      'Peak Fitness Studio', 'Mike Rodriguez',
      'Peak Fitness has a database of 1,800+ unconverted leads sitting cold in GHL — our analysis estimates $18K-$32K in recoverable first-month revenue.',
      'Deploy Dead Lead Revival Android against the existing lead database. We handle AI conversation, workflow setup, and delivery. Zero setup fee, zero monthly retainer.',
      '- Dead Lead Revival Android deployed to Peak''s GHL\n- AI-run conversations with unconverted leads\n- Direct-to-calendar booking\n- Weekly revenue reporting\n- Full delivery by the Aether Team',
      '50% of net profit on recovered revenue. No setup. No monthly.',
      'If we don''t book at least $5K in recovered revenue in the first 30 days, you pay nothing.',
      'Sign the agreement and we kick off deployment this week. First revenue targets hit within 14 days.',
      'strong',
      'Strong fit — established database, clear conversion gap, aligned on profit-share structure during discovery call.',
      TRUE, v_sprint_start + INTERVAL '11 days', 'pending', v_sprint_start + INTERVAL '10 days'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM proposals WHERE user_id = p_user_id AND prospect_id = v_prospect_a) THEN
    INSERT INTO proposals (
      user_id, prospect_id, offer_id, call_script_id,
      prospect_business, prospect_name,
      problem_summary, solution_summary, deliverables, investment, guarantee, next_step,
      confidence_score, confidence_reason,
      sent, sent_at, deal_status, created_at
    ) VALUES (
      p_user_id, v_prospect_a, v_offer_id, v_call_script_id,
      'Glow Med Spa', 'Sarah Chen',
      'Glow Med Spa is generating 120+ monthly leads from Meta ads but closing under 15% — roughly $22K/month in booked revenue is being left on the table.',
      'Dead Lead Revival Android runs against Glow''s 2,400-lead historical database, plus ongoing reactivation of new leads that don''t convert in their first 30 days.',
      '- Dead Lead Revival Android deployed\n- AI conversations handling objections + booking\n- Integration with Glow''s existing consult calendar\n- Weekly revenue reports\n- Monthly strategy review',
      '50% of net profit. Zero setup. Zero monthly.',
      'First 30 days: if we don''t book at least $8K in recovered revenue, you pay nothing.',
      'Sign agreement Monday, kickoff Tuesday. First revenue targeted by end of week 2.',
      'strong',
      'Perfect ICP. Sarah aligned on structure, active database is large, clear immediate revenue opportunity.',
      TRUE, v_sprint_start + INTERVAL '11 days', 'won', v_sprint_start + INTERVAL '11 days'
    );
  END IF;

  -- ------------------------------------------------------------------
  -- Audit — 1 completed audit tied to Sarah (the won deal)
  -- ------------------------------------------------------------------
  SELECT id INTO v_audit_id FROM audits WHERE user_id = p_user_id AND prospect_email = 'sarah@glowmedspa.com';
  IF v_audit_id IS NULL THEN
    INSERT INTO audits (
      user_id, name, prospect_name, prospect_email, industry, business_size,
      niche_id, status, completion_percentage, completed_at,
      executive_summary, report_ready, created_at, updated_at
    ) VALUES (
      p_user_id, 'Glow Med Spa Audit', 'Sarah Chen', 'sarah@glowmedspa.com',
      'Med Spa', 'small', v_niche_a, 'completed', 100, v_sprint_start + INTERVAL '10 days',
      'Glow Med Spa is leaving ~$22K/month on the table from unconverted Meta leads. Fix: Dead Lead Revival deployment + lead-scoring refresh.',
      TRUE, v_sprint_start + INTERVAL '9 days', v_sprint_start + INTERVAL '10 days'
    );
  END IF;

  -- ------------------------------------------------------------------
  -- Notifications — a handful of realistic alerts
  -- Type must be one of: audit_submitted, quiz_completed, reply_received, new_prospect, deal_won
  -- ------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE user_id = p_user_id) THEN
    INSERT INTO notifications (user_id, type, title, body, action_href, read, created_at)
    VALUES
      (p_user_id, 'new_prospect', 'Mike opened your proposal', 'Peak Fitness Studio proposal was opened 3 times in the last 2 hours.', '/proposal/builder', FALSE, NOW() - INTERVAL '3 hours'),
      (p_user_id, 'deal_won', 'Glow Med Spa signed', 'Sarah Chen accepted the Dead Lead Revival proposal. Kickoff scheduled.', '/pipeline', TRUE, v_sprint_start + INTERVAL '11 days'),
      (p_user_id, 'reply_received', 'New reply from Jessica Miller', 'Radiant Bridal Studio replied — waiting for your response.', '/outreach', FALSE, v_sprint_start + INTERVAL '10 days');
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Seed any admin emails that have already signed up
-- ---------------------------------------------------------------------------
-- Walks auth.users and calls the seed function for every admin email that
-- has a corresponding row. Skips silently for emails that haven't signed
-- up yet — those get handled by the trigger on their first profile insert,
-- and the seed can be filled in by re-running this block after signup.

DO $$
DECLARE
  admin_emails TEXT[] := ARRAY[
    'hello@aetheraiconsulting.org',
    'anjal@aetheraiconsulting.org',
    'adam@aetheraiconsulting.org'
  ];
  admin_email  TEXT;
  v_user_id    UUID;
BEGIN
  FOREACH admin_email IN ARRAY admin_emails LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email = admin_email LIMIT 1;

    IF v_user_id IS NULL THEN
      RAISE NOTICE 'Admin email % has not signed up yet — trigger will promote them on first profile write. Re-run this migration after signup to populate seed data.', admin_email;
    ELSE
      PERFORM public.seed_admin_test_data(v_user_id, admin_email);
      RAISE NOTICE 'Seeded admin account for %', admin_email;
    END IF;
  END LOOP;
END $$;
