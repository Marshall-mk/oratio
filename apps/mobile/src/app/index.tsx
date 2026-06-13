import { Redirect } from 'expo-router';

// Entry route: authenticated users land on Progress (the AuthGate handles the
// sign-in / onboarding redirects before this renders).
export default function Index() {
  return <Redirect href="/progress" />;
}
