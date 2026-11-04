import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { BrandMark, Card, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const enterWithGoogle = async () => {
    setBusy(true);
    setErrorMessage('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar com Google. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <BrandMark />
            <Text style={{ color: COLORS.redDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 12 }}>ESTUDO DE SEGURANÇA</Text>
          </View>

          <Card style={{ padding: 24, borderRadius: 22 }}>
            <View style={{ width: 44, height: 4, borderRadius: 4, backgroundColor: COLORS.red, marginBottom: 20 }} />
            <Text style={{ color: COLORS.ink, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7 }}>Bem-vindo</Text>
            <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>
              Entre com sua conta Google pessoal para acessar o seu espaço de trabalho.
            </Text>

            {!!errorMessage && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18, marginTop: 18 }}>{errorMessage}</Text>}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entrar com uma conta Google"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => void enterWithGoogle()}
              style={({ pressed }) => ({
                minHeight: 54,
                marginTop: 24,
                paddingHorizontal: 16,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#D8DCE3',
                backgroundColor: COLORS.surface,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed || busy ? 0.75 : 1,
              })}>
              {busy ? <ActivityIndicator color={COLORS.red} /> : <>
                <Text style={{ color: '#4285F4', fontSize: 21, lineHeight: 24, fontWeight: '900', marginRight: 12 }}>G</Text>
                <Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: '800' }}>Continuar com Google</Text>
              </>}
            </Pressable>

            <View style={{ marginTop: 20, paddingTop: 17, borderTopWidth: 1, borderTopColor: COLORS.border }}>
              <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                Você será direcionado ao Google para confirmar sua conta. Se a verificação em duas etapas estiver ativada, o Google solicitará a confirmação.
              </Text>
            </View>
          </Card>

          <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 18 }}>
            Sua senha do Google não é compartilhada com este aplicativo.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}
