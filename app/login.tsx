import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BrandMark, Card, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabaseConfigurationMessage } from '@/lib/supabase';

export default function LoginScreen() {
  const { configured, requestEmailCode, verifyEmailCode, signInWithMicrosoft } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const run = async (action: () => Promise<void>) => {
    setMessage(''); setErrorMessage(''); setBusy(true);
    try { await action(); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Não foi possível concluir o acesso.'); }
    finally { setBusy(false); }
  };

  const normalizedEmail = email.trim().toLowerCase();
  const ensureOutlookMailbox = () => {
    if (normalizedEmail.endsWith('@gmail.com') || normalizedEmail.endsWith('@googlemail.com')) {
      throw new Error('Use seu endereço Outlook, Hotmail, Live ou e-mail corporativo Microsoft para receber o código.');
    }
  };
  const sendCode = () => run(async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Informe um endereço de e-mail válido.');
    ensureOutlookMailbox();
    await requestEmailCode(normalizedEmail);
    setCodeSent(true);
    setMessage(`Enviamos um código de verificação para ${normalizedEmail}. Confira também a pasta de lixo eletrônico.`);
  });

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
            <BrandMark />
            <Text style={{ color: COLORS.ink, fontSize: 29, lineHeight: 34, fontWeight: '900', marginTop: 30 }}>Acesse seu espaço{ '\n' }de trabalho</Text>
            <Text style={{ color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 9 }}>Entre para sincronizar seus estudos e conversar com sua equipe.</Text>
            <Card style={{ marginTop: 24, gap: 14 }}>
              {!configured ? <Text accessibilityRole="alert" style={{ color: COLORS.text, fontSize: 13, lineHeight: 20 }}>{supabaseConfigurationMessage}</Text> : <>
                <View>
                  <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }}>E-mail Outlook ou corporativo Microsoft</Text>
                  <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setCodeSent(false); setCode(''); }} editable={!busy} placeholder="nome@outlook.com" placeholderTextColor="#A9A1A4" style={inputStyle} accessibilityLabel="E-mail Outlook ou Microsoft" />
                </View>
                {codeSent && <View>
                  <Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }}>Código de verificação</Text>
                  <TextInput autoCapitalize="none" autoComplete="one-time-code" keyboardType="number-pad" value={code} onChangeText={setCode} editable={!busy} placeholder="Digite o código recebido" placeholderTextColor="#A9A1A4" style={inputStyle} accessibilityLabel="Código de verificação enviado por e-mail" />
                </View>}
                {!!message && <Text accessibilityLiveRegion="polite" style={{ color: COLORS.success, fontSize: 12, lineHeight: 18 }}>{message}</Text>}
                {!!errorMessage && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18 }}>{errorMessage}</Text>}
                <PrimaryButton disabled={busy || !normalizedEmail || (codeSent && code.trim().length < 6)} onPress={() => void run(async () => {
                  ensureOutlookMailbox();
                  if (!codeSent) { await requestEmailCode(normalizedEmail); setCodeSent(true); setMessage(`Solicitamos o envio de um código para ${normalizedEmail}. Confira também a pasta de lixo eletrônico.`); return; }
                  await verifyEmailCode(normalizedEmail, code);
                })}>
                  {busy ? 'Aguarde…' : codeSent ? 'Confirmar código e entrar' : 'Enviar código para meu Outlook'}
                </PrimaryButton>
                {codeSent && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void sendCode()} style={({ pressed }) => [{ paddingVertical: 7, opacity: pressed ? 0.7 : 1 }]}><Text style={{ color: COLORS.red, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>Enviar outro código</Text></Pressable>}
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 }}>
                  <PrimaryButton disabled={busy} onPress={() => void run(signInWithMicrosoft)} style={{ backgroundColor: COLORS.ink }}>
                    {busy ? 'Aguarde…' : 'Entrar com conta Microsoft'}
                  </PrimaryButton>
                </View>
                <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>O código é enviado para o endereço informado. A entrega depende da configuração de e-mail do Supabase. A entrada Microsoft permite carregar a foto oficial do perfil quando disponível.</Text>
              </>}
            </Card>
            <Text style={{ color: COLORS.muted, fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 16 }}>{configured ? 'A autenticação e os dados remotos são protegidos pelo Supabase.' : 'A autenticação e o armazenamento remoto precisam de credenciais do Supabase.'}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const inputStyle = { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, color: COLORS.ink, fontSize: 14 } as const;
