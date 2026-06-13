-- M7 Scenario Gym: roleplay challenges (AI persona) + social evaluation stage.

-- 1. Challenge mode + persona.
alter table public.challenges
  add column mode text not null default 'monologue'
    check (mode in ('monologue', 'roleplay')),
  add column persona jsonb;  -- {name, voice, instruction, opener} for roleplay

-- Roleplay scenarios get their own category (Phase 3 Communication Gym +
-- Phase 6 Social Intelligence).
alter table public.challenges drop constraint challenges_category_check;
alter table public.challenges
  add constraint challenges_category_check
  check (category in ('thought', 'structure', 'speaking', 'scenario'));

-- 2. Allow the 4th evaluation stage. Drop and re-add the stage check.
alter table public.scores drop constraint scores_stage_check;
alter table public.scores
  add constraint scores_stage_check
  check (stage in ('thought', 'structure', 'delivery', 'social'));

-- 3. Transcripts already store `segments jsonb`; for roleplay each segment is
--    {role: 'user'|'persona', text, turn}. No schema change needed, but record
--    the conversation turn count for convenience.
alter table public.transcripts add column turn_count int;
