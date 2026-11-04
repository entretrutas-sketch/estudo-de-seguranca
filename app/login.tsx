import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BrandMark, Card, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { register, signInWithEmployee, configured } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(''); const [employeeNumber, setEmployeeNumber] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [errorMessage, setErrorMessage] = useState(''); const [notice, setNotice] = useState('');
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
  const inputStyle = { minHeight: 50, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, marginTop: 12, color: COLORS.ink, backgroundColor: '#fff' } as const;
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
      <View style={{ width: '100%', maxWidth: 450, alignSelf: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 22 }}><BrandMark /><Text style={{ color: COLORS.redDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 10 }}>ESTUDO DE SEGURANÇA</Text></View>
        <Card style={{ padding: 22, borderRadius: 22 }}>
          <View style={{ width: 44, height: 4, borderRadius: 4, backgroundColor: COLORS.red, marginBottom: 18 }} />
          <Text style={{ color: COLORS.ink, fontSize: 26, fontWeight: '900' }}>{mode === 'login' ? 'Acesso do especialista' : 'Solicitar acesso'}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 7 }}>{mode === 'login' ? 'Entre com sua matrícula e senha corporativa.' : 'Preencha seus dados. A gestão verificará sua solicitação.'}</Text>
          {mode === 'register' && <>
            <TextInput accessibilityLabel="Nome completo" placeholder="Nome completo" value={name} onChangeText={setName} autoCapitalize="words" style={inputStyle} />
            <TextInput accessibilityLabel="E-mail corporativo" placeholder="E-mail @verisure.com.br" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={inputStyle} />
          </>}
          <TextInput accessibilityLabel="Matrícula" placeholder="Matrícula" value={employeeNumber} onChangeText={setEmployeeNumber} autoCapitalize="characters" autoCorrect={false} style={inputStyle} />
          <TextInput accessibilityLabel="Senha" placeholder={mode === 'register' ? 'Crie uma senha (mínimo 10 caracteres)' : 'Senha'} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" style={inputStyle} />
          {notice ? <Text accessibilityRole="alert" style={{ color: COLORS.success, fontSize: 13, lineHeight: 19, marginTop: 16 }}>{notice}</Text> : null}
          {errorMessage ? <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 13, lineHeight: 19, marginTop: 16 }}>{errorMessage}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy || !configured} onPress={() => void submit()} style={({ pressed }) => ({ minHeight: 52, marginTop: 22, borderRadius: 13, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', opacity: pressed || busy || !configured ? 0.7 : 1 })}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>{mode === 'login' ? 'Entrar' : 'Enviar solicitação'}</Text>}
          </Pressable>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setErrorMessage(''); setNotice(''); }} style={{ padding: 14, alignItems: 'center', marginTop: 4 }}><Text style={{ color: COLORS.redDark, fontWeight: '800' }}>{mode === 'login' ? 'Ainda não tenho acesso · Solicitar cadastro' : 'Já tenho acesso · Voltar para entrar'}</Text></Pressable>
          {!configured && <Text style={{ color: COLORS.redDark, fontSize: 12, textAlign: 'center' }}>O serviço de autenticação ainda não está configurado.</Text>}
        </Card>
        <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 16 }}>Acesso individual, liberado após validação da gestão.</Text>
      </View>
    </ScrollView>
  </KeyboardAvoidingView></Screen>;
}
