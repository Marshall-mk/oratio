import type { Challenge } from '@/types/api';

// How each Gym category presents its drills.
export interface GymGroup {
  key: string;
  label: string;
  blurb?: string;
}

export type GymLayout =
  // tiles per group -> wheel picker of that group's drills
  | { kind: 'groups'; groupBy: 'subcategory' | 'difficulty'; groups: GymGroup[] }
  // straight to a wheel picker over all the category's drills
  | { kind: 'wheel' }
  // plain scrolling list of drills
  | { kind: 'list' };

const LEVELS: GymGroup[] = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'expert', label: 'Expert' },
];

export const GYM_LAYOUT: Record<string, GymLayout> = {
  thought: {
    kind: 'groups',
    groupBy: 'subcategory',
    groups: [
      { key: 'idea_expansion', label: 'Idea Expansion', blurb: 'Develop an idea from many angles' },
      { key: 'argument_builder', label: 'Argument Builder', blurb: 'Claim, evidence, rebuttal' },
      { key: 'first_principles', label: 'First Principles', blurb: 'Reason up from fundamentals' },
      { key: 'mental_models', label: 'Mental Models', blurb: 'Explain with analogy' },
      { key: 'thinking_speed', label: 'Thinking Speed', blurb: 'Think fast under a timer' },
    ],
  },
  structure: {
    kind: 'groups',
    groupBy: 'subcategory',
    groups: [
      { key: 'prep', label: 'PREP', blurb: 'Point · Reason · Example · Point' },
      { key: 'star', label: 'STAR', blurb: 'Situation · Task · Action · Result' },
      { key: 'scientific', label: 'Scientific', blurb: 'Problem · Gap · Method · Result · Impact' },
      { key: 'story', label: 'Story', blurb: 'Context · Conflict · Resolution · Lesson' },
      { key: 'pyramid', label: 'Pyramid', blurb: 'Conclusion first, evidence after' },
    ],
  },
  scenario: { kind: 'groups', groupBy: 'difficulty', groups: LEVELS },
  speaking: { kind: 'groups', groupBy: 'difficulty', groups: LEVELS },
  coach: { kind: 'wheel' },
};

export function gymLayout(category: string): GymLayout {
  return GYM_LAYOUT[category] ?? { kind: 'list' };
}

export function groupLabel(category: string, key: string): string {
  const layout = GYM_LAYOUT[category];
  if (layout?.kind === 'groups') {
    return layout.groups.find((g) => g.key === key)?.label ?? key;
  }
  return key;
}

/** Drills belonging to a group, using the category's grouping field. */
export function drillsInGroup(category: string, key: string, drills: Challenge[]): Challenge[] {
  const layout = GYM_LAYOUT[category];
  const field = layout?.kind === 'groups' && layout.groupBy === 'difficulty' ? 'difficulty' : 'subcategory';
  return drills.filter((d) => d[field] === key);
}
