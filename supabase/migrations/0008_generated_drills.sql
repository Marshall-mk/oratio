-- AI-generated, per-user drills (the "Random" option). Stored as hidden
-- challenge rows (is_active = false) so they never appear in the catalog list
-- but flow through the normal challenge → session → evaluation pipeline.

alter table public.challenges
  add column generated_for uuid references auth.users (id) on delete cascade,
  add column gen_topic text; -- short topic label, used to avoid repeats

create index challenges_generated_idx
  on public.challenges (generated_for, category, created_at desc);
