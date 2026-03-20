import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080C14' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="age-gate" />
      <Stack.Screen name="fitness-disclaimer" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="tutorial" />
    </Stack>
  );
}
