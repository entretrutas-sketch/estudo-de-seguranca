import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { PrimaryButton, Screen } from '@/components/mobile-ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <Screen><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}><Text style={{ fontSize: 20, fontWeight: 'bold' }}>Esta tela não existe.</Text><Link href="/" asChild><PrimaryButton>Voltar ao início</PrimaryButton></Link></View></Screen>
    </>
  );
}

