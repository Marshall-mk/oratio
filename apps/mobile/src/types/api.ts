export interface Profile {
  user_id: string;
  display_name: string | null;
  profession: string | null;
  industry: string | null;
  education: string | null;
  goals: string[];
  weaknesses: string[];
  strengths: string[];
  speaking_confidence: number | null;
  primary_use_cases: string[];
  onboarding_completed_at: string | null;
}

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  category: 'thought' | 'structure' | 'speaking' | 'scenario' | 'coach';
  framework: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  prep_seconds: number;
  max_speak_seconds: number;
  tags: string[];
  mode: 'monologue' | 'roleplay' | 'live_coach';
  persona_name: string | null;
  persona_opener: string | null;
}
