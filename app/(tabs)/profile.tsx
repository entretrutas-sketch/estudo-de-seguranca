import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
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
  const [region, setRegion] = useState('');
  const [team, setTeam] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [availability, setAvailability] = useState<'unknown' | 'available' | 'busy' | 'offline'>('unknown');
  const [directoryError, setDirectoryError] = useState('');
  const avatar = profile.avatarUrl || String(user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? '');

  useEffect(() => {
    if (!supabase || !user) return;
    let active = true;
    void supabase.from('specialist_directory').select('region,team_name,specialties,availability').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!active || !data) return;
      setRegion(data.region ?? ''); setTeam(data.team_name ?? ''); setSpecialties((data.specialties ?? []).join(', '));
      setAvailability(data.availability ?? 'unknown');
    });
    return () => { active = false; };
  }, [user?.id]);

  const saveProfile = async () => {
    if (!supabase || !user) { Alert.alert('Perfil local', 'Conecte Supabase para salvar os dados do perfil.'); return; }
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ display_name: profile.name }).eq('id', user.id);
    setBusy(false);
    Alert.alert(error ? 'Não foi possível salvar' : 'Perfil atualizado', error?.message ?? 'Dados sincronizados com o backend.');
  };

  const saveDirectory = async () => {
    if (!supabase || !user) return;
    setBusy(true); setDirectoryError('');
    const specialtiesList = specialties.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12);
    const { error } = await supabase.from('specialist_directory').update({ region: region.trim().slice(0, 100), team_name: team.trim().slice(0, 100), specialties: specialtiesList, availability }).eq('user_id', user.id);
    setBusy(false);
    if (error) setDirectoryError('Não foi possível atualizar o perfil público do diretório. Confira a conexão e tente novamente.');
    else Alert.alert('Perfil atualizado', 'Suas informações de colaboração estão disponíveis para especialistas autorizados.');
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

  const fieldStyle = { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, marginTop: 6, color: COLORS.ink, backgroundColor: COLORS.surface };
  return <Screen><Header title="Perfil e segurança"/><View style={{ flex: 1 }}><Card style={{ margin: 20, alignItems: 'center' }}>
    <ProductImage source={avatar ? { uri: avatar } : avatarFallback} label={avatar ? `Foto oficial de ${profile.name}` : 'Avatar padrão Verisure'} style={{ width: 96, height: 96, borderRadius: 48 }}/>
    <Text style={{ color: COLORS.ink, fontSize: 20, fontWeight: '900', marginTop: 14 }}>{profile.name}</Text>
    <Text style={{ color: COLORS.muted, marginTop: 5 }}>{profile.email || 'E-mail ainda não disponível'}</Text>
    <PrimaryButton disabled={busy} onPress={() => void changePhoto()} style={{ marginTop: 18, alignSelf: 'stretch' }}>{busy ? 'Enviando…' : 'Alterar foto de perfil'}</PrimaryButton>
    <PrimaryButton disabled={busy} onPress={() => void saveProfile()} style={{ marginTop: 10, alignSelf: 'stretch' }}>{busy ? 'Salvando…' : 'Sincronizar perfil'}</PrimaryButton>
  </Card>
  <Card style={{ marginHorizontal: 20, marginBottom: 20 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 16 }}>Perfil no diretório</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>Visível apenas para especialistas aprovados. E-mail, matrícula e telefone não são publicados.</Text>
    <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 14 }}>Região</Text><TextInput accessibilityLabel="Região" value={region} onChangeText={setRegion} placeholder="Ex.: São Paulo · Zona Sul" style={fieldStyle}/>
    <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 12 }}>Equipe</Text><TextInput accessibilityLabel="Equipe" value={team} onChangeText={setTeam} placeholder="Nome da equipe" style={fieldStyle}/>
    <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 12 }}>Especialidades</Text><TextInput accessibilityLabel="Especialidades" value={specialties} onChangeText={setSpecialties} placeholder="Separe por vírgula" style={fieldStyle}/>
    <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800', marginTop: 12 }}>Disponibilidade</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{([['unknown', 'Não informada'], ['available', 'Disponível'], ['busy', 'Ocupado'], ['offline', 'Offline']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: availability === value }} onPress={() => setAvailability(value)} style={{ minHeight: 44, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: availability === value ? COLORS.redSoft : COLORS.surface, borderColor: availability === value ? COLORS.red : COLORS.border, borderWidth: 1 }}><Text style={{ color: availability === value ? COLORS.redDark : COLORS.text, fontSize: 11, fontWeight: '800' }}>{label}</Text></Pressable>)}</View>
    {!!directoryError && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, marginTop: 10 }}>{directoryError}</Text>}
    <PrimaryButton disabled={busy} onPress={() => void saveDirectory()} style={{ marginTop: 12 }}>{busy ? 'Salvando…' : 'Salvar perfil de colaboração'}</PrimaryButton>
    <Pressable accessibilityRole="button" onPress={() => void signOut()} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}><Text style={{ color: COLORS.red, fontWeight: '900' }}>Sair da conta</Text></Pressable>
  </Card></View></Screen>;
}
