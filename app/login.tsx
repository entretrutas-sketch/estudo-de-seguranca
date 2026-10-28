import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { BrandMark, Card, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { isCorporateEmail, normalizeCorporateEmail, corporateEmailMessage } from '@/lib/corporate-email';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { signInLocally, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const emailValid = isCorporateEmail(normalizeCorporateEmail(email));
  const canContinue = useMemo(() => !!name.trim() && emailValid, [name, emailValid]);

  const enter = async () => {
    setBusy(true);
    setErrorMessage('');
    try { await signInLocally(name, email); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Não foi possível abrir o acesso local.'); }
    finally { setBusy(false); }
  };

  return <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <BrandMark />
          <Text style={{ color: COLORS.ink, fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 26 }}>Acesse seu espaço{'\n'}de trabalho</Text>
          <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>Identifique-se para começar um Estudo de Segurança.</Text>
          <Card style={{ marginTop: 24, gap: 15 }}>
            <View>
              <Text style={labelStyle}>Nome completo</Text>
              <TextInput autoCapitalize="words" autoComplete="name" textContentType="name" value={name} onChangeText={setName} editable={!busy} placeholder="Seu nome e sobrenome" placeholderTextColor="#A9A1A4" style={inputStyle} accessibilityLabel="Nome completo" returnKeyType="next" />
            </View>
            <View>
              <Text style={labelStyle}>E-mail corporativo</Text>
              <TextInput autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy} placeholder="nome@verisure.com.br" placeholderTextColor="#A9A1A4" style={[inputStyle, !!email && { borderColor: emailValid ? COLORS.success : COLORS.redDark }]} accessibilityLabel="E-mail corporativo Verisure" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => { if (canContinue) void enter(); }} />
              <Text style={{ color: email && !emailValid ? COLORS.redDark : COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 6 }}>{email && !emailValid ? corporateEmailMessage : 'Somente endereços @verisure.com.br.'}</Text>
            </View>
            {!!errorMessage && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18 }}>{errorMessage}</Text>}
            <PrimaryButton disabled={busy || !canContinue} onPress={() => void enter()}>{busy ? 'Aguarde…' : 'Entrar no aplicativo'}</PrimaryButton>
            <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 13, gap: 10 }}>
              <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center' }}>Prefere entrar com sua conta Google corporativa?</Text>
              <PrimaryButton disabled={busy} onPress={() => {
                setBusy(true);
                setErrorMessage('');
                void signInWithGoogle().catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Não foi possível entrar com Google.')).finally(() => setBusy(false));
              }} style={{ backgroundColor: COLORS.ink }}>{busy ? 'Aguarde…' : 'Entrar com Gmail'}</PrimaryButton>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 }}>
              <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 17, textAlign: 'center' }}>Google OAuth precisa estar habilitado no Supabase. O acesso local temporário não verifica identidade nem sincroniza dados. Contas permitidas: @verisure.com.br.</Text>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const labelStyle = { color: COLORS.ink, fontSize: 12, fontWeight: '800' as const, marginBottom: 7 };
const inputStyle = { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 } as const;
