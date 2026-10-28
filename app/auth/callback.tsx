import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Screen } from '@/components/mobile-ui';
import { router } from 'expo-router';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';

export default function AuthCallbackScreen() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  return (
    <Screen><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.canvas, padding: 24 }}>
      <ActivityIndicator color={COLORS.red} />
      <Text style={{ color: COLORS.ink, fontSize: 15, fontWeight: '800', marginTop: 14 }}>Concluindo seu acesso…</Text>
    </View></Screen>
  );
}
