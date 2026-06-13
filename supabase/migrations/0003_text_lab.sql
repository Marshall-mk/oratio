-- M8 Text Lab: Reading Comprehension (Phase 5) + Vocabulary Academy (Phase 4).
-- Text-in/text-out exercises, independent of the voice/attempt pipeline.

create table public.text_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('reading', 'vocabulary')),
  -- vocabulary: word_upgrade | sentence_upgrade | academic_rewrite |
  --             professional_rewrite | persuasive_rewrite | simplify
  -- reading:    comprehension
  subtype text not null,
  source_title text,
  source_text text not null,          -- pasted article / word / sentence
  content jsonb,                      -- generated reading pack OR vocab analysis
  submission jsonb,                   -- user's quiz answers (reading)
  score numeric(3, 1),                -- 1.0-10.0 (comprehension or vocabulary)
  feedback jsonb,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'scored', 'failed')),
  created_at timestamptz not null default now()
);

create index text_exercises_user_idx on public.text_exercises (user_id, created_at desc);

alter table public.text_exercises enable row level security;

create policy "own text_exercises" on public.text_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
