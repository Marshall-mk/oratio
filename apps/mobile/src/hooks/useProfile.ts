import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { Profile } from '@/types/api';

export function useProfile(enabled = true) {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api<Profile>('/me/profile'),
    enabled,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: Record<string, unknown>) =>
      api<Profile>('/me/profile', { method: 'PUT', body: JSON.stringify(update) }),
    onSuccess: (profile) => queryClient.setQueryData(['profile'], profile),
  });
}
