import { useState } from 'react';
import { Alert, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Card, Header, ProductImage, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

const avatarFallback = require('../../assets/verisure-logo.png');

export default function ProfileScreen() {
  const { profile, updateProfileAvatarUrl } = useApp();
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const avatar = profile.avatarUrl || String(user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? '');

  const saveProfile = async () => {
    if (!supabase || !user) { Alert.alert('Perfil local', 'Conecte Supabase para salvar os dados do perfil.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ display_name: profile.name }).eq('id', user.id);
    setBusy(false);
    Alert.alert(error ? 'Não foi possível salvar' : 'Perfil atualizado', error?.message ?? 'Dados sincronizados com o backend.');
  };

  const changePhoto = async () => {
    if (!supabase || !user) { Alert.alert('Perfil', 'Conecte sua conta para alterar a foto.'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permissão necessária', 'Autorize o acesso às fotos para escolher uma imagem de perfil.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const image = result.assets[0];
    if (image.fileSize && image.fileSize > 5 * 1024 * 1024) { Alert.alert('Imagem muito grande', 'Escolha uma imagem de até 5 MB.'); return; }
    const contentType = image.mimeType ?? 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) { Alert.alert('Formato inválido', 'Use uma imagem JPEG, PNG ou WebP.'); return; }
    setBusy(true);
    try {
      const response = await fetch(image.uri); const blob = await response.blob();
      if (!response.ok || blob.size > 5 * 1024 * 1024) throw new Error('Não foi possível ler a imagem ou ela excede 5 MB.');
      const path = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, blob, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      const { error: profileError } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id);
      if (profileError) throw profileError;
      const { data, error: signedError } = await supabase.storage.from('profile-avatars').createSignedUrl(path, 60 * 60);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error('Não foi possível carregar a foto.');
      updateProfileAvatarUrl(data.signedUrl);
      Alert.alert('Foto atualizada', 'Sua foto de perfil foi salva.');
    } catch (error) { Alert.alert('Não foi possível atualizar', error instanceof Error ? error.message : 'Tente novamente.'); }
    finally { setBusy(false); }
  };

  return <Screen><Header title="Perfil do especialista"/><Card style={{ margin: 20, alignItems: 'center' }}>
    <ProductImage source={avatar ? { uri: avatar } : avatarFallback} label={avatar ? `Foto oficial de ${profile.name}` : 'Avatar padrão Verisure'} style={{ width: 96, height: 96, borderRadius: 48 }}/>
    <Text style={{ color: COLORS.ink, fontSize: 20, fontWeight: '900', marginTop: 14 }}>{profile.name}</Text>
    <Text style={{ color: COLORS.muted, marginTop: 5 }}>{profile.email || 'E-mail ainda não disponível'}</Text>
    <PrimaryButton disabled={busy} onPress={() => void changePhoto()} style={{ marginTop: 18, alignSelf: 'stretch' }}>{busy ? 'Enviando…' : 'Alterar foto de perfil'}</PrimaryButton>
    <PrimaryButton disabled={busy} onPress={() => void saveProfile()} style={{ marginTop: 18, alignSelf: 'stretch' }}>{busy ? 'Salvando…' : 'Sincronizar perfil'}</PrimaryButton>
    <Text onPress={() => void signOut()} accessibilityRole="button" style={{ color: COLORS.red, fontWeight: '900', marginTop: 18 }}>Sair da conta</Text>
  </Card></Screen>;
}
