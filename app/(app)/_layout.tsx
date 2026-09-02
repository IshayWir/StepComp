import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create" options={{ presentation: 'modal', title: 'New Challenge' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal', title: 'Join Challenge' }} />
      <Stack.Screen name="challenge/[id]" />
      <Stack.Screen name="challenge/[id]/participant/[userId]" />
    </Stack>
  );
}
