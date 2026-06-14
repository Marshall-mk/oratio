-- Group drills within a category into subcategories (Thought, Structure).

alter table public.challenges add column subcategory text;

-- Thought subcategories (from existing tags).
update public.challenges set subcategory = 'idea_expansion'
  where category = 'thought' and 'idea-expansion' = any (tags);
update public.challenges set subcategory = 'argument_builder'
  where category = 'thought' and 'argument-builder' = any (tags);
update public.challenges set subcategory = 'first_principles'
  where category = 'thought' and 'first-principles' = any (tags);
update public.challenges set subcategory = 'mental_models'
  where category = 'thought' and 'mental-models' = any (tags);
update public.challenges set subcategory = 'thinking_speed'
  where category = 'thought' and 'thinking-speed' = any (tags);

-- Structure subcategories = the framework.
update public.challenges set subcategory = framework
  where category = 'structure' and framework is not null;
