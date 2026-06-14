export type DebateFormat = 'ranked' | 'sides' | 'rebuttal';

export interface DebateParticipant {
  name: string;
  side: string | null;
}

export interface DebateRanking {
  name: string;
  rank: number;
  score: number;
  critique: string;
}

export interface DebateResult {
  winner: string;
  rationale: string;
  winning_side: string | null;
  rankings: DebateRanking[];
}

export interface Debate {
  id: string;
  motion: string;
  format: DebateFormat;
  participants: DebateParticipant[];
  status: 'in_progress' | 'complete';
  result: DebateResult | null;
  turns: { participant: string; round: number; transcript: string }[];
}

export const FORMAT_OPTIONS: { value: DebateFormat; label: string; blurb: string }[] = [
  { value: 'ranked', label: 'Free-for-all', blurb: 'Everyone argues the motion; best speaker wins' },
  { value: 'sides', label: 'For vs Against', blurb: 'Two sides; AI picks the winning side & top speaker' },
  { value: 'rebuttal', label: 'Opening + rebuttal', blurb: 'Two rounds — open, then rebut' },
];
