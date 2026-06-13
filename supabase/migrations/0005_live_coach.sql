-- M10 Live Coach (Phase 9): real-time delivery coaching during free practice.
-- Reuses sessions/attempts/evaluation by adding a 'live_coach' challenge mode
-- in its own 'coach' category (one challenge per coaching mode).

alter table public.challenges drop constraint challenges_mode_check;
alter table public.challenges
  add constraint challenges_mode_check
  check (mode in ('monologue', 'roleplay', 'live_coach'));

alter table public.challenges drop constraint challenges_category_check;
alter table public.challenges
  add constraint challenges_category_check
  check (category in ('thought', 'structure', 'speaking', 'scenario', 'coach'));
