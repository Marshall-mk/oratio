-- M9 Personal Communication Model (Phase 7) + Analytics (Phase 8).

-- Deterministic per-attempt metrics (computed, not AI-judged).
create table public.communication_metrics (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  words int,
  duration_seconds numeric,
  wpm numeric,
  unique_words int,
  unique_ratio numeric,            -- type-token ratio
  avg_sentence_length numeric,
  filler_count int,
  filler_rate numeric,             -- fillers per 100 words
  question_count int,
  reading_ease numeric,            -- Flesch reading ease (approx)
  long_pause_count int,            -- gaps > 2s between live segments (live only)
  created_at timestamptz not null default now()
);

alter table public.communication_metrics enable row level security;
create policy "own metrics" on public.communication_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vector memory: one embedded summary per evaluated attempt → the "communication
-- twin". Retrieved on later evaluations to personalize feedback over time.
create table public.memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete cascade,
  summary text not null,           -- human-readable memory line
  embedding vector(768),           -- gemini-embedding-001 @ 768 dims
  created_at timestamptz not null default now()
);

create index memory_embeddings_user_idx on public.memory_embeddings (user_id, created_at desc);

alter table public.memory_embeddings enable row level security;
create policy "own memory" on public.memory_embeddings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
