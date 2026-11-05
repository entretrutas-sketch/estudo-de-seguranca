import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { BrandMark, Card, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';

const inputStyle = {
  minHeight: 54,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 13,
  paddingHorizontal: 15,
  marginTop: 6,
  color: COLORS.ink,
  backgroundColor: COLORS.surface,
  fontSize: 14,
} as const;

const labelStyle = {
  color: COLORS.text,
  fontSize: 10,
  fontWeight: '800' as const,
  letterSpacing: 0.8,
  marginTop: 15,
};

export default function LoginScreen() {
  const { register, signInWithEmployee, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async () => {
    setBusy(true); setErrorMessage(''); setNotice('');
    try {
      if (mode === 'register') {
        await register(name, employeeNumber, email, password);
        setNotice('Solicitação enviada. Seu cadastro está aguardando autorização da gestão. Você poderá entrar com sua matrícula e senha após a aprovação.');
        setMode('login'); setPassword('');
      } else {
        const result = await signInWithEmployee(employeeNumber, password);
        if (result === 'pending') setNotice('Seu cadastro ainda está aguardando autorização da gestão.');
        else if (result === 'rejected') setErrorMessage('Este cadastro não foi aprovado. Procure a gestão para mais informações.');
        else if (result === 'invalid') setErrorMessage('Matrícula ou senha inválida.');
      }
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.'); }
    finally { setBusy(false); }
  };

  const isLogin = mode === 'login';

  return <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center', marginBottom: 22 }}>
            <BrandMark />
            <Text style={{ color: COLORS.ink, fontSize: 10, fontWeight: '800', letterSpacing: 2.2, marginTop: 5 }}>ESTUDO DE SEGURANÇA</Text>
          </View>

          <Card style={{ padding: 23, borderRadius: 24, borderColor: '#E1E5EC', shadowOpacity: 0.09, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.redSoft, alignItems: 'center', justifyContent: 'center' }}>
                <SymbolView name={{ ios: 'lock.shield.fill', android: 'verified_user', web: 'verified_user' }} tintColor={COLORS.red} size={24} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.redDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 }}>ACESSO CORPORATIVO</Text>
                <Text style={{ color: COLORS.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 }}>{isLogin ? 'Acesso seguro' : 'Solicitar acesso'}</Text>
              </View>
            </View>

            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 13 }}>
              {isLogin ? 'Entre com suas credenciais corporativas para acessar o portal de estudos.' : 'Informe seus dados corporativos para análise e liberação pela gestão.'}
            </Text>

            {mode === 'register' && <>
              <Text style={labelStyle}>NOME COMPLETO</Text>
              <TextInput accessibilityLabel="Nome completo" placeholder="Seu nome e sobrenome" placeholderTextColor="#929AAA" value={name} onChangeText={setName} autoCapitalize="words" autoComplete="name" style={inputStyle} />
              <Text style={labelStyle}>E-MAIL CORPORATIVO</Text>
              <TextInput accessibilityLabel="E-mail corporativo" placeholder="nome@verisure.com.br" placeholderTextColor="#929AAA" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} style={inputStyle} />
            </>}

            <Text style={labelStyle}>MATRÍCULA</Text>
            <TextInput accessibilityLabel="Matrícula" placeholder="Informe sua matrícula" placeholderTextColor="#929AAA" value={employeeNumber} onChangeText={setEmployeeNumber} autoCapitalize="characters" autoCorrect={false} style={inputStyle} />
            <Text style={labelStyle}>SENHA</Text>
            <TextInput accessibilityLabel="Senha" placeholder={mode === 'register' ? 'Crie uma senha (mínimo 10 caracteres)' : 'Digite sua senha'} placeholderTextColor="#929AAA" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={inputStyle} />

            {notice ? <View style={{ marginTop: 15, borderRadius: 12, padding: 13, backgroundColor: '#EAF7F0', borderWidth: 1, borderColor: '#D4EDE0' }}><Text accessibilityRole="alert" style={{ color: COLORS.success, fontSize: 13, lineHeight: 19, fontWeight: '700' }}>{notice}</Text></View> : null}
            {errorMessage ? <View style={{ marginTop: 15, borderRadius: 12, padding: 13, backgroundColor: COLORS.redSoft, borderWidth: 1, borderColor: '#FAD0D9' }}><Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 13, lineHeight: 19, fontWeight: '700' }}>{errorMessage}</Text></View> : null}

            <Pressable accessibilityRole="button" disabled={busy || !configured} onPress={() => void submit()} style={({ pressed }) => ({ minHeight: 54, marginTop: 21, borderRadius: 14, backgroundColor: COLORS.red, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', opacity: pressed || busy || !configured ? 0.72 : 1, shadowColor: COLORS.redDark, shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 })}>
              {busy ? <ActivityIndicator color="#fff" /> : <>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>{isLogin ? 'Entrar no portal' : 'Enviar solicitação'}</Text>
                <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor="#fff" size={17} />
              </>}
            </Pressable>

            <Pressable accessibilityRole="button" onPress={() => { setMode(isLogin ? 'register' : 'login'); setErrorMessage(''); setNotice(''); }} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
              <Text style={{ color: COLORS.redDark, fontWeight: '800', fontSize: 12 }}>{isLogin ? 'Ainda não tem acesso? Solicite seu cadastro' : 'Já tem acesso? Voltar para entrar'}</Text>
            </Pressable>
            {!configured && <Text style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 }}>O serviço de autenticação ainda não está configurado.</Text>}
          </Card>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 17, paddingHorizontal: 14 }}>
            <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={COLORS.muted} size={13} />
            <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>Acesso individual para colaboradores e parceiros autorizados.</Text>
          </View>
          <Text style={{ color: '#929AAA', fontSize: 10, textAlign: 'center', marginTop: 10 }}>Ambiente corporativo · Verisure</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}
