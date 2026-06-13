import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export interface UserSettings {
  has_api_key: boolean;
  api_key_hint: string | null;
  using_own_key: boolean;
  eval_model: string;
  available_models: string[];
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api<UserSettings>('/me/settings'),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { gemini_api_key?: string; eval_model?: string }) =>
      api<UserSettings>('/me/settings', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (settings) => queryClient.setQueryData(['settings'], settings),
  });
}
