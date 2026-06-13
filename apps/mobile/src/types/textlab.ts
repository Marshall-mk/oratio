export interface ReadingQuizQuestion {
  question: string;
  options: string[];
}

export interface ReadingContent {
  summary: string;
  definitions: { term: string; meaning: string }[];
  key_ideas: string[];
  argument_map: { claim: string; support: string }[];
  quiz: ReadingQuizQuestion[];
}

export interface ReadingFeedback {
  correct: number;
  total: number;
  per_question: {
    your_answer: number | null;
    correct_index: number;
    explanation: string;
    is_correct: boolean;
  }[];
}

export interface VocabContent {
  improved: string;
  changes: { original: string; replacement: string; reason: string }[];
}

export interface TextExercise {
  id: string;
  kind: 'reading' | 'vocabulary';
  subtype: string;
  source_title: string | null;
  source_text: string;
  content: (ReadingContent & VocabContent) | null;
  submission: { answers: number[] } | null;
  score: number | null;
  feedback: (ReadingFeedback & { feedback: string }) | null;
  status: 'generating' | 'ready' | 'scored' | 'failed';
  created_at: string;
}

export const VOCAB_DRILLS: { subtype: string; label: string; hint: string }[] = [
  { subtype: 'word_upgrade', label: 'Word Upgrade', hint: 'Sharpen weak, vague words' },
  { subtype: 'sentence_upgrade', label: 'Sentence Upgrade', hint: 'Tighter, clearer, stronger' },
  { subtype: 'academic_rewrite', label: 'Academic Rewrite', hint: 'Formal scholarly register' },
  { subtype: 'professional_rewrite', label: 'Professional Rewrite', hint: 'Clear business tone' },
  { subtype: 'persuasive_rewrite', label: 'Persuasive Rewrite', hint: 'More compelling' },
  { subtype: 'simplify', label: 'Simplify', hint: 'Explain it plainly' },
];
