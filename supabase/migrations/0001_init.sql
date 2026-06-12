-- Veritas initial schema
-- Conventions: all user-owned tables carry user_id and RLS owner policies.
-- The backend connects with its own credentials and enforces ownership in queries;
-- RLS protects direct client access (supabase-js) from the mobile app.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  profession text,
  industry text,
  education text,
  goals text[] not null default '{}',
  weaknesses text[] not null default '{}',
  strengths text[] not null default '{}',
  speaking_confidence int check (speaking_confidence between 1 and 5),
  primary_use_cases text[] not null default '{}',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- challenges (global content, readable by all authenticated users)
-- ---------------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  prompt text not null,
  category text not null check (category in ('thought', 'structure', 'speaking')),
  framework text check (framework in ('prep', 'star', 'scientific', 'story', 'pyramid')),
  difficulty text not null default 'beginner'
    check (difficulty in ('beginner', 'intermediate', 'advanced', 'expert')),
  prep_seconds int not null default 30,
  max_speak_seconds int not null default 120,
  evaluation_focus jsonb not null default '{}',
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

create policy "challenges readable" on public.challenges
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- sessions: one per (user, challenge) practice run; groups attempts for retry/compare
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.sessions enable row level security;

create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- attempts
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_number int not null default 1,
  status text not null default 'recording'
    check (status in ('recording', 'uploaded', 'transcribing', 'evaluating', 'complete', 'failed')),
  duration_seconds numeric,
  transcription_mode text not null default 'live'
    check (transcription_mode in ('live', 'fallback')),
  created_at timestamptz not null default now(),
  unique (session_id, attempt_number)
);

create index attempts_user_created_idx on public.attempts (user_id, created_at desc);

alter table public.attempts enable row level security;

create policy "own attempts" on public.attempts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- audio_files
-- ---------------------------------------------------------------------------
create table public.audio_files (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  mime_type text not null default 'audio/wav',
  size_bytes bigint,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);

alter table public.audio_files enable row level security;

create policy "own audio" on public.audio_files
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- transcripts
-- ---------------------------------------------------------------------------
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_text text not null,
  segments jsonb not null default '[]', -- [{text, start_ms, end_ms}]
  word_count int,
  source text not null default 'gemini_live'
    check (source in ('gemini_live', 'gemini_batch')),
  created_at timestamptz not null default now()
);

alter table public.transcripts enable row level security;

create policy "own transcripts" on public.transcripts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- scores: one row per evaluation stage per attempt
-- ---------------------------------------------------------------------------
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stage text not null check (stage in ('thought', 'structure', 'delivery')),
  score numeric(3, 1) not null check (score between 1.0 and 10.0),
  dimensions jsonb not null default '[]', -- [{dimension, score, rationale}]
  summary text,
  created_at timestamptz not null default now(),
  unique (attempt_id, stage)
);

create index scores_user_stage_idx on public.scores (user_id, stage, created_at);

alter table public.scores enable row level security;

create policy "own scores" on public.scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- feedback_reports
-- ---------------------------------------------------------------------------
create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  overall_score numeric(3, 1) not null,
  diagnosis text not null,
  strengths jsonb not null default '[]',
  weaknesses jsonb not null default '[]',
  best_sentence jsonb,  -- {text, reason}
  worst_sentence jsonb, -- {text, reason}
  suggested_rewrite text,
  retry_challenge text,
  model text not null,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

alter table public.feedback_reports enable row level security;

create policy "own reports" on public.feedback_reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Future-proofing stubs (gamification & payments deferred, schema reserved)
-- ---------------------------------------------------------------------------
create table public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_activity_date date
);

alter table public.streaks enable row level security;

create policy "own streak" on public.streaks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.achievements enable row level security;

create policy "achievements readable" on public.achievements
  for select using (auth.role() = 'authenticated');

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "own user_achievements" on public.user_achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text,
  status text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private recordings bucket, owner-scoped by first path segment
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "own recordings read" on storage.objects
  for select using (
    bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own recordings insert" on storage.objects
  for insert with check (
    bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own recordings delete" on storage.objects
  for delete using (
    bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text
  );
