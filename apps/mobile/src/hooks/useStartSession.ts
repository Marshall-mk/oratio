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

/** Create a session + first attempt for a challenge, then open the recording screen. */
export function useStartSession() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const session = await api<SessionOut>('/sessions', {
        method: 'POST',
        body: JSON.stringify({ challenge_id: challengeId }),
      });
      return api<AttemptOut>(`/sessions/${session.id}/attempts`, { method: 'POST' });
    },
    onSuccess: (attempt, challengeId) => {
      router.push({
        pathname: '/session/[attemptId]',
        params: { attemptId: attempt.id, challengeId },
      });
    },
  });
}

/** Start another attempt in an existing session (retry). */
export function useRetryAttempt() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (input: { sessionId: string; challengeId: string }) =>
      api<AttemptOut>(`/sessions/${input.sessionId}/attempts`, { method: 'POST' }),
    onSuccess: (attempt, input) => {
      router.replace({
        pathname: '/session/[attemptId]',
        params: { attemptId: attempt.id, challengeId: input.challengeId },
      });
    },
  });
}
