import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { api } from '@/lib/api';

interface SessionOut {
  id: string;
  challenge_id: string;
}

interface AttemptOut {
  id: string;
  session_id: string;
  attempt_number: number;
  status: string;
}

type Mode = 'monologue' | 'roleplay' | 'live_coach';

function screenFor(mode: Mode): '/roleplay/[attemptId]' | '/coach/[attemptId]' | '/session/[attemptId]' {
  if (mode === 'roleplay') return '/roleplay/[attemptId]';
  if (mode === 'live_coach') return '/coach/[attemptId]';
  return '/session/[attemptId]';
}

/** Create a session + first attempt, then open the right screen for the mode. */
export function useStartSession() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: { challengeId: string; mode: Mode }) => {
      const session = await api<SessionOut>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ challenge_id: input.challengeId }),
      });
      return api<AttemptOut>(`/sessions/${session.id}/attempts`, { method: 'POST' });
    },
    onSuccess: (attempt, input) => {
      router.push({
        pathname: screenFor(input.mode),
        params: { attemptId: attempt.id, challengeId: input.challengeId },
      });
    },
  });
}

/** Start another attempt in an existing session (retry). */
export function useRetryAttempt() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: { sessionId: string; challengeId: string; mode: Mode }) =>
      api<AttemptOut>(`/sessions/${input.sessionId}/attempts`, { method: 'POST' }),
    onSuccess: (attempt, input) => {
      router.replace({
        pathname: screenFor(input.mode),
        params: { attemptId: attempt.id, challengeId: input.challengeId },
      });
    },
  });
}
