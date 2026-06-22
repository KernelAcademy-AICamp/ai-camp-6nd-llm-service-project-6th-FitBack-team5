import { Stack } from 'expo-router';

export default function CustomWorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="select" />
      <Stack.Screen name="routine" />
      <Stack.Screen name="record" />
      <Stack.Screen name="share" />
    </Stack>
  );
}
