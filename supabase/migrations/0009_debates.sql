-- Debate Arena: local pass-and-play group debates judged by the AI.

create table public.debates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade, -- host
  motion text not null,
  format text not null check (format in ('ranked', 'sides', 'rebuttal')),
  participants jsonb not null default '[]', -- [{name, side}]
  status text not null default 'in_progress' check (status in ('in_progress', 'complete')),
  result jsonb, -- {winner, rationale, winning_side, rankings: [{name, rank, score, critique}]}
  created_at timestamptz not null default now()
);

alter table public.debates enable row level security;
create policy "own debates" on public.debates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.debate_turns (
  id uuid primary key default gen_random_uuid(),
  debate_id uuid not null references public.debates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  participant text not null,
  round int not null default 1,
  transcript text not null default '',
  created_at timestamptz not null default now()
);

create index debate_turns_debate_idx on public.debate_turns (debate_id);

alter table public.debate_turns enable row level security;
create policy "own debate_turns" on public.debate_turns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
