import { create } from 'zustand';

interface OnboardingState {
  displayName: string;
  profession: string;
  industry: string;
  education: string;
  goals: string[];
  weaknesses: string[];
  speakingConfidence: number | null;
  primaryUseCases: string[];
  set: (partial: Partial<Omit<OnboardingState, 'set'>>) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  displayName: '',
  profession: '',
  industry: '',
  education: '',
  goals: [],
  weaknesses: [],
  speakingConfidence: null,
  primaryUseCases: [],
  set: (partial) => set(partial),
}));
