-- Live Coach modes (Phase 9). Free-practice monologue with real-time coaching.

insert into public.challenges
  (slug, title, prompt, category, mode, difficulty, prep_seconds, max_speak_seconds, evaluation_focus, tags)
values
('coach-presentation', 'Presentation',
 'Deliver your presentation as if your audience is in front of you. Speak naturally — the coach will guide your pacing, clarity, and filler words in real time.',
 'coach', 'live_coach', 'intermediate', 10, 300, '{}', '{presentation}'),

('coach-interview', 'Interview Answer',
 'Answer as if in a real interview. Be concise and structured — the coach watches for rambling and pacing while you speak.',
 'coach', 'live_coach', 'intermediate', 10, 240, '{}', '{interview}'),

('coach-meeting', 'Meeting Update',
 'Give your update as if speaking in a meeting. Lead with the point; the coach flags filler and run-ons live.',
 'coach', 'live_coach', 'beginner', 10, 180, '{}', '{meeting}'),

('coach-research-defense', 'Research Defense',
 'Defend your work as if facing reviewers. Speak with precision and confidence — the coach tracks pacing and clarity in real time.',
 'coach', 'live_coach', 'advanced', 15, 360, '{}', '{research}');
