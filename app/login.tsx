import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BrandMark, Card, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { corporateEmailMessage, isCorporateEmail, normalizeCorporateEmail } from '@/lib/corporate-email';
import { useAuth } from '@/lib/auth-context';
import { supabaseConfigurationMessage } from '@/lib/supabase';

export default function LoginScreen() {
  const { configured, requestEmailCode, verifyEmailCode, signInWithMicrosoft } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const normalizedEmail = normalizeCorporateEmail(email);
  const emailValid = isCorporateEmail(normalizedEmail);
  const canContinue = useMemo(() => !!name.trim() && emailValid && (!codeSent || code.trim().length >= 6), [name, emailValid, codeSent, code]);

  const run = async (action: () => Promise<void>) => {
    setMessage(''); setErrorMessage(''); setBusy(true);
    try { await action(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Não foi possível concluir o acesso.'); }
    finally { setBusy(false); }
  };

  const sendCode = () => run(async () => {
    if (!name.trim()) throw new Error('Informe seu nome completo.');
    if (!emailValid) throw new Error(corporateEmailMessage);
    await requestEmailCode(normalizedEmail, name.trim());
    setCodeSent(true);
    setMessage(`Enviamos um código de verificação para ${normalizedEmail}. Confira também a pasta de lixo eletrônico.`);
  });

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <BrandMark />
            <Text style={{ color: COLORS.ink, fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 26 }}>Acesse seu espaço{ '\n' }de trabalho</Text>
            <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>Entre com sua conta corporativa Verisure para sincronizar estudos e conversar com sua equipe.</Text>
            <Card style={{ marginTop: 24, gap: 14 }}>
              {!configured ? <Text accessibilityRole="alert" style={{ color: COLORS.ink, fontSize: 13, lineHeight: 20 }}>{supabaseConfigurationMessage}</Text> : <>
                <View>
                  <Text style={labelStyle}>Nome completo</Text>
                  <TextInput autoCapitalize="words" autoComplete="name" textContentType="name" value={name} onChangeText={setName} editable={!busy} placeholder="Seu nome e sobrenome" placeholderTextColor="#A9A1A4" style={inputStyle} accessibilityLabel="Nome completo" returnKeyType="next" />
                </View>
                <View>
                  <Text style={labelStyle}>E-mail corporativo</Text>
                  <TextInput autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setCodeSent(false); setCode(''); setMessage(''); setErrorMessage(''); }} editable={!busy} placeholder="nome.sobrenome@verisure.com.br" placeholderTextColor="#A9A1A4" style={[inputStyle, !!email && { borderColor: emailValid ? COLORS.success : COLORS.redDark }]} accessibilityLabel="E-mail corporativo Verisure" autoCorrect={false} returnKeyType="next" />
                  <Text style={{ color: email && !emailValid ? COLORS.redDark : COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 6 }}>{email && !emailValid ? corporateEmailMessage : 'Somente contas @verisure.com.br podem acessar o aplicativo.'}</Text>
                </View>
                {codeSent && <View>
                  <Text style={labelStyle}>Código de verificação</Text>
                  <TextInput autoCapitalize="none" autoComplete="one-time-code" keyboardType="number-pad" value={code} onChangeText={setCode} editable={!busy} placeholder="Digite o código recebido no Outlook" placeholderTextColor="#A9A1A4" style={inputStyle} accessibilityLabel="Código de verificação enviado por e-mail" />
                </View>}
                {!!message && <Text accessibilityLiveRegion="polite" style={{ color: COLORS.success, fontSize: 12, lineHeight: 18 }}>{message}</Text>}
                {!!errorMessage && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18 }}>{errorMessage}</Text>}
                <PrimaryButton disabled={busy || !canContinue} onPress={() => void run(async () => {
                  if (!name.trim()) throw new Error('Informe seu nome completo.');
                  if (!emailValid) throw new Error(corporateEmailMessage);
                  if (!codeSent) {
                    await requestEmailCode(normalizedEmail, name.trim());
                    setCodeSent(true);
                    setMessage(`Solicitamos um código para ${normalizedEmail}. Confira sua caixa de entrada do Outlook e o lixo eletrônico.`);
                    return;
                  }
                  await verifyEmailCode(normalizedEmail, code);
                })}>
                  {busy ? 'Aguarde…' : codeSent ? 'Confirmar código e entrar' : 'Enviar código para meu Outlook'}
                </PrimaryButton>
                {codeSent && <Pressable accessibilityRole="button" disabled={busy || !emailValid} onPress={() => void sendCode()} style={({ pressed }) => [{ paddingVertical: 7, opacity: pressed ? 0.7 : 1 }]}><Text style={{ color: COLORS.red, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>Enviar outro código</Text></Pressable>}
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14, gap: 10 }}>
                  <Text style={{ color: COLORS.muted, fontSize: 11, textAlign: 'center' }}>Ou use sua conta Microsoft corporativa para entrar e carregar a foto oficial do perfil.</Text>
                  <PrimaryButton disabled={busy} onPress={() => void run(signInWithMicrosoft)} style={{ backgroundColor: COLORS.ink }}>
                    {busy ? 'Aguarde…' : 'Entrar com Microsoft corporativa'}
                  </PrimaryButton>
                </View>
                <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>O código é enviado para o e-mail corporativo informado. A entrega depende da configuração de e-mail do Supabase.</Text>
              </>}
            </Card>
            <Text style={{ color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 16 }}>{configured ? 'A autenticação e os dados remotos são protegidos pelo Supabase.' : 'A autenticação e o armazenamento remoto precisam de credenciais do Supabase.'}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const labelStyle = { color: COLORS.ink, fontSize: 12, fontWeight: '800' as const, marginBottom: 7 };
const inputStyle = { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 } as const;
