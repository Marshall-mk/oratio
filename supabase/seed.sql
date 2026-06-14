-- ōrātiō challenge library seed (MVP: ~30 challenges across thought / structure / speaking)

insert into public.challenges
  (slug, title, prompt, category, framework, difficulty, prep_seconds, max_speak_seconds, evaluation_focus, tags)
values
-- ---------------------------------------------------------------------------
-- THOUGHT (PRD Phase 0: idea expansion, argument building, first principles,
-- mental models, thinking speed)
-- ---------------------------------------------------------------------------
('idea-remote-work', 'Idea Expansion: Remote Work',
 'Should companies keep remote work? Develop the strongest possible answer, exploring at least three distinct angles.',
 'thought', null, 'beginner', 30, 120,
 '{"thought": {"depth": 1.5, "completeness": 1.3}}', '{idea-expansion}'),

('idea-hospital-ai', 'Idea Expansion: AI in Hospitals',
 'Why should hospitals invest in AI diagnostics? Build a complete case covering benefits, risks, and evidence.',
 'thought', null, 'intermediate', 30, 150,
 '{"thought": {"evidence": 1.5, "reasoning": 1.3}}', '{idea-expansion}'),

('idea-four-day-week', 'Idea Expansion: Four-Day Week',
 'Argue for or against the four-day work week. Anticipate what a skeptic would say and address it.',
 'thought', null, 'intermediate', 30, 150,
 '{"thought": {"reasoning": 1.5}}', '{idea-expansion}'),

('argument-social-media', 'Argument Builder: Social Media & Teens',
 'Build a full argument on whether social media harms teenagers: state a claim, give evidence, raise the strongest counterargument, rebut it, and conclude.',
 'thought', null, 'intermediate', 60, 180,
 '{"thought": {"logic": 1.5, "completeness": 1.4}}', '{argument-builder}'),

('argument-college-worth', 'Argument Builder: Is College Worth It?',
 'Is a university degree still worth the cost? Claim, evidence, counterargument, rebuttal, conclusion.',
 'thought', null, 'beginner', 60, 180,
 '{"thought": {"logic": 1.5}}', '{argument-builder}'),

('argument-open-source', 'Argument Builder: Open Source',
 'Should companies open-source their core technology? Build the complete argument with counterargument and rebuttal.',
 'thought', null, 'advanced', 60, 180,
 '{"thought": {"logic": 1.4, "insight": 1.3}}', '{argument-builder}'),

('first-principles-your-field', 'First Principles: Your Field',
 'Pick a core practice or tool from your own field and explain, from first principles, why it exists at all.',
 'thought', null, 'advanced', 60, 180,
 '{"thought": {"depth": 1.5, "originality": 1.2}}', '{first-principles}'),

('analogy-your-work', 'Mental Models: Explain by Analogy',
 'Explain what you do for work (or study) using one extended analogy a 12-year-old would follow.',
 'thought', null, 'beginner', 30, 90,
 '{"thought": {"insight": 1.4}, "delivery": {"clarity": 1.4}}', '{mental-models,analogy}'),

('analogy-internet', 'Mental Models: The Internet',
 'Explain how the internet works using only an analogy — no technical terms allowed.',
 'thought', null, 'intermediate', 30, 120,
 '{"thought": {"insight": 1.4}, "delivery": {"clarity": 1.5}}', '{mental-models,analogy}'),

('speed-5s-invention', 'Thinking Speed: Best Invention (5s prep)',
 'What is the most important invention of the last 100 years, and why? You have 5 seconds to prepare.',
 'thought', null, 'advanced', 5, 60,
 '{"thought": {"reasoning": 1.3}, "delivery": {"confidence": 1.4}}', '{thinking-speed}'),

('speed-10s-advice', 'Thinking Speed: One Piece of Advice (10s prep)',
 'What one piece of advice would you give your younger self, and why? 10 seconds to prepare.',
 'thought', null, 'intermediate', 10, 60,
 '{"delivery": {"confidence": 1.4, "conciseness": 1.2}}', '{thinking-speed}'),

-- ---------------------------------------------------------------------------
-- STRUCTURE (PRD Phase 2: PREP, STAR, scientific, story, pyramid)
-- ---------------------------------------------------------------------------
('prep-best-hire', 'PREP: A Great Decision',
 'Describe a great decision you (or your team) made. Use PREP: Point, Reason, Example, Point.',
 'structure', 'prep', 'beginner', 30, 90,
 '{"structure": {"organization": 1.5, "completeness": 1.3}}', '{prep}'),

('prep-recommendation', 'PREP: Recommend a Change',
 'Recommend one change your team or organization should make. Point, Reason, Example, restate the Point.',
 'structure', 'prep', 'intermediate', 30, 90,
 '{"structure": {"organization": 1.5}}', '{prep}'),

('star-challenge-overcome', 'STAR: A Challenge You Overcame',
 'Tell the story of a difficult problem you solved, using STAR: Situation, Task, Action, Result.',
 'structure', 'star', 'beginner', 60, 120,
 '{"structure": {"completeness": 1.4, "flow": 1.3}}', '{star,interview}'),

('star-conflict', 'STAR: A Conflict You Resolved',
 'Describe a time you handled disagreement with a colleague or teammate. Situation, Task, Action, Result.',
 'structure', 'star', 'intermediate', 60, 120,
 '{"structure": {"completeness": 1.4}}', '{star,interview}'),

('star-leadership', 'STAR: Leading Under Pressure',
 'Describe a time you had to lead when things were going wrong. Keep each STAR component crisp.',
 'structure', 'star', 'advanced', 60, 120,
 '{"structure": {"completeness": 1.4, "redundancy": 1.3}}', '{star,interview,leadership}'),

('scientific-own-project', 'Scientific: Pitch Your Project',
 'Present any project you have worked on as research: Problem, Gap, Method, Result, Impact.',
 'structure', 'scientific', 'intermediate', 60, 180,
 '{"structure": {"hierarchy": 1.4, "completeness": 1.4}}', '{scientific,research}'),

('scientific-favorite-paper', 'Scientific: Explain a Paper or Idea',
 'Summarize a paper, book, or big idea you know well using Problem, Gap, Method, Result, Impact.',
 'structure', 'scientific', 'advanced', 60, 240,
 '{"structure": {"hierarchy": 1.5}}', '{scientific,research}'),

('story-turning-point', 'Story: A Turning Point',
 'Tell a true story about a turning point in your life: Context, Conflict, Resolution, Lesson.',
 'structure', 'story', 'beginner', 60, 150,
 '{"structure": {"flow": 1.5}, "delivery": {"engagement": 1.4}}', '{story,storytelling}'),

('story-failure-lesson', 'Story: A Useful Failure',
 'Tell the story of a failure that taught you something important. Context, Conflict, Resolution, Lesson.',
 'structure', 'story', 'intermediate', 60, 150,
 '{"structure": {"flow": 1.4}, "delivery": {"engagement": 1.3}}', '{story,storytelling}'),

('pyramid-budget-ask', 'Pyramid: Make an Ask',
 'Ask for something concrete (budget, time, headcount, a favor). Conclusion first, then supporting evidence — Pyramid Principle.',
 'structure', 'pyramid', 'intermediate', 30, 90,
 '{"structure": {"hierarchy": 1.5, "organization": 1.4}}', '{pyramid,persuasion}'),

('pyramid-status-update', 'Pyramid: 60-Second Status Update',
 'Give a 60-second project status update to a busy executive. Lead with the headline, then only the evidence that matters.',
 'structure', 'pyramid', 'advanced', 30, 60,
 '{"structure": {"hierarchy": 1.5}, "delivery": {"conciseness": 1.5}}', '{pyramid,leadership}'),

-- ---------------------------------------------------------------------------
-- SPEAKING (PRD Phases 1/3: public speaking, teaching, interview, persuasion,
-- networking, storytelling)
-- ---------------------------------------------------------------------------
('speak-intro-yourself', 'Introduce Yourself',
 'Introduce yourself as if meeting a new team for the first time: who you are, what you do, what you care about.',
 'speaking', null, 'beginner', 30, 60,
 '{"delivery": {"clarity": 1.4, "confidence": 1.3}}', '{networking,interview}'),

('speak-elevator-pitch', 'Elevator Pitch',
 'Pitch yourself, your project, or your research in 30 seconds to someone influential you just met in an elevator.',
 'speaking', null, 'intermediate', 30, 30,
 '{"delivery": {"conciseness": 1.5, "persuasion": 1.4}}', '{networking,pitch}'),

('speak-teach-something', 'Teach Something You Know',
 'Teach a concept you know well to a complete beginner. Check that every term you use would make sense to them.',
 'speaking', null, 'beginner', 60, 180,
 '{"delivery": {"clarity": 1.5, "engagement": 1.3}}', '{teaching}'),

('speak-persuade-habit', 'Persuade: Adopt a Habit',
 'Convince a skeptical friend to adopt one habit you genuinely believe in. Address their likely objections.',
 'speaking', null, 'intermediate', 30, 120,
 '{"delivery": {"persuasion": 1.5}, "thought": {"reasoning": 1.3}}', '{persuasion}'),

('speak-interview-why-you', 'Interview: Why Should We Hire You?',
 'Answer the interview question: "Why should we hire you over other candidates?" Be specific, not generic.',
 'speaking', null, 'intermediate', 30, 90,
 '{"delivery": {"confidence": 1.5, "persuasion": 1.3}}', '{interview}'),

('speak-interview-weakness', 'Interview: Your Biggest Weakness',
 'Answer "What is your biggest weakness?" honestly and strategically — no clichés.',
 'speaking', null, 'advanced', 30, 90,
 '{"thought": {"insight": 1.4}, "delivery": {"confidence": 1.3}}', '{interview}'),

('speak-toast', 'Give a Toast',
 'Give a 60-second toast at a friend''s celebration. Make it warm, personal, and memorable.',
 'speaking', null, 'beginner', 60, 60,
 '{"delivery": {"engagement": 1.5}}', '{public-speaking,storytelling}'),

('speak-unpopular-opinion', 'Defend an Unpopular Opinion',
 'Pick an opinion you hold that most people disagree with, and defend it persuasively without being dismissive.',
 'speaking', null, 'advanced', 60, 150,
 '{"thought": {"originality": 1.4}, "delivery": {"persuasion": 1.4}}', '{debate,persuasion}'),

('speak-explain-news', 'Explain a Complex Topic in the News',
 'Pick a complex topic currently in the news and explain it neutrally to someone who has never heard of it.',
 'speaking', null, 'expert', 60, 180,
 '{"delivery": {"clarity": 1.5}, "thought": {"completeness": 1.3}}', '{teaching,public-speaking}');
