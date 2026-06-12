import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useProfile } from '@/hooks/useProfile';
import { useSupabaseSession } from '@/hooks/useSupabaseSession';
import { colors } from '@/theme';

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSupabaseSession();
  const profile = useProfile(!!session);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || (session && profile.isLoading)) return;
    const inAuth = segments[0] === '(auth)';
    const inOnboarding = segments[0] === '(onboarding)';

    if (!session && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (session && profile.data && !profile.data.onboarding_completed_at && !inOnboarding) {
      router.replace('/(onboarding)/profile');
    } else if (session && profile.data?.onboarding_completed_at && (inAuth || inOnboarding)) {
      router.replace('/');
    }
  }, [session, loading, profile.isLoading, profile.data, segments, router]);

  if (loading || (session && profile.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </AuthGate>
      <StatusBar style="light" />
    </QueryClientProvider>
  );
}
