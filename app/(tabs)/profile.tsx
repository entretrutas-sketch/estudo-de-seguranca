import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Card, Header, ProductImage, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const avatarFallback = require('../../assets/verisure-logo.png');

export default function ProfileScreen() {
  const { profile } = useApp();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const avatar = profile.avatarUrl || String(user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? '');

  const saveProfile = async () => {
    if (!supabase || !user) { Alert.alert('Perfil local', 'Conecte Supabase para salvar os dados do perfil.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').upsert({ id: user.id, display_name: profile.name, email: profile.email });
    setBusy(false);
    Alert.alert(error ? 'Não foi possível salvar' : 'Perfil atualizado', error?.message ?? 'Dados sincronizados com o backend.');
  };

  return <Screen><Header title="Perfil do especialista"/><Card style={{ margin: 20, alignItems: 'center' }}>
    <ProductImage source={avatar ? { uri: avatar } : avatarFallback} label={avatar ? `Foto oficial de ${profile.name}` : 'Avatar padrão Verisure'} style={{ width: 96, height: 96, borderRadius: 48 }}/>
    <Text style={{ color: COLORS.ink, fontSize: 20, fontWeight: '900', marginTop: 14 }}>{profile.name}</Text>
    <Text style={{ color: COLORS.muted, marginTop: 5 }}>{profile.email || 'E-mail ainda não disponível'}</Text>
    <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 12, textAlign: 'center' }}>A foto oficial da conta Microsoft é carregada quando o usuário autoriza o acesso ao perfil. Sem foto disponível, o app mantém a identificação visual padrão.</Text>
    <PrimaryButton disabled={busy} onPress={() => void saveProfile()} style={{ marginTop: 18, alignSelf: 'stretch' }}>{busy ? 'Salvando…' : 'Sincronizar perfil'}</PrimaryButton>
    <Text onPress={() => void signOut()} accessibilityRole="button" style={{ color: COLORS.red, fontWeight: '900', marginTop: 18 }}>Sair da conta</Text>
  </Card></Screen>;
}
