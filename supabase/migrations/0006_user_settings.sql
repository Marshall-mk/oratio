-- Per-user "bring your own key" AI settings: own Gemini API key + model choice.
-- The raw key is never returned to the client in full (the API masks it).

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  gemini_api_key text,   -- user's own key; null = use the server default
  eval_model text,       -- model for evaluation + text lab; null = server default
  live_model text,       -- model for live transcription; null = server default
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
