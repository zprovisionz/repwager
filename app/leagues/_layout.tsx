import { Stack } from 'expo-router';

export default function LeaguesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080C14' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="bracket" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
