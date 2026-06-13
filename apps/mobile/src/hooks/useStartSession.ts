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

/** Create a session + first attempt, then open the right screen for the mode. */
export function useStartSession() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: { challengeId: string; mode: 'monologue' | 'roleplay' }) => {
      const session = await api<SessionOut>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ challenge_id: input.challengeId }),
      });
      return api<AttemptOut>(`/sessions/${session.id}/attempts`, { method: 'POST' });
    },
    onSuccess: (attempt, input) => {
      router.push({
        pathname: input.mode === 'roleplay' ? '/roleplay/[attemptId]' : '/session/[attemptId]',
        params: { attemptId: attempt.id, challengeId: input.challengeId },
      });
    },
  });
}

/** Start another attempt in an existing session (retry). */
export function useRetryAttempt() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      challengeId: string;
      mode: 'monologue' | 'roleplay';
    }) => api<AttemptOut>(`/sessions/${input.sessionId}/attempts`, { method: 'POST' }),
    onSuccess: (attempt, input) => {
      router.replace({
        pathname: input.mode === 'roleplay' ? '/roleplay/[attemptId]' : '/session/[attemptId]',
        params: { attemptId: attempt.id, challengeId: input.challengeId },
      });
    },
  });
}
