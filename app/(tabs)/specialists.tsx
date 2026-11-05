import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Card, Header, PrimaryButton, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';

type Specialist = { user_id: string; display_name: string; avatar_path: string; avatar_url?: string; region: string; specialties: string[]; team_name: string; availability: 'unknown' | 'available' | 'busy' | 'offline'; last_seen_at: string | null };
type Filter = 'Todos' | 'Disponível' | 'Ocupado' | 'Offline';
const filters: Filter[] = ['Todos', 'Disponível', 'Ocupado', 'Offline'];
const availabilityLabel: Record<Specialist['availability'], string> = { available: 'Disponível', busy: 'Ocupado', offline: 'Offline', unknown: 'Disponibilidade não informada' };

export default function SpecialistsScreen() {
  const { profile } = useApp();
  const [people, setPeople] = useState<Specialist[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('Todas as regiões');
  const [specialty, setSpecialty] = useState('Todas as especialidades');
  const [availability, setAvailability] = useState<Filter>('Todos');
  const [team, setTeam] = useState('Todas as equipes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); setError('O diretório precisa de conexão com o servidor.'); return; }
    setLoading(true); setError('');
    const { data, error: problem } = await supabase.from('specialist_directory').select('user_id,display_name,avatar_path,region,specialties,team_name,availability,last_seen_at').order('display_name');
    if (problem) setError('Não foi possível carregar o diretório. Confirme se a atualização do banco foi aplicada e tente novamente.');
    else {
      const withAvatars = await Promise.all(((data ?? []) as Specialist[]).map(async (person) => {
        if (!person.avatar_path) return person;
        const { data: signed } = await supabase!.storage.from('profile-avatars').createSignedUrl(person.avatar_path, 15 * 60);
        return { ...person, avatar_url: signed?.signedUrl };
      }));
      setPeople(withAvatars);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const regions = useMemo(() => ['Todas as regiões', ...Array.from(new Set(people.map((person) => person.region).filter(Boolean))).sort()], [people]);
  const specialties = useMemo(() => ['Todas as especialidades', ...Array.from(new Set(people.flatMap((person) => person.specialties ?? []))).sort()], [people]);
  const teams = useMemo(() => ['Todas as equipes', ...Array.from(new Set(people.map((person) => person.team_name).filter(Boolean))).sort()], [people]);
  const visiblePeople = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR');
    return people.filter((person) => {
      const matchesSearch = !needle || [person.display_name, person.region, person.team_name, ...(person.specialties ?? [])].join(' ').toLocaleLowerCase('pt-BR').includes(needle);
      const matchesAvailability = availability === 'Todos' || availabilityLabel[person.availability] === availability;
      return matchesSearch && matchesAvailability && (region === 'Todas as regiões' || person.region === region) && (specialty === 'Todas as especialidades' || person.specialties.includes(specialty)) && (team === 'Todas as equipes' || person.team_name === team);
    });
  }, [people, query, region, specialty, availability, team]);

  return <Screen>
    <Header eyebrow="COLABORAÇÃO" title="Especialistas" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <SectionLabel>REDE AUTORIZADA</SectionLabel>
      <Text style={{ color: COLORS.ink, fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 8 }}>Encontre a pessoa certa para colaborar.</Text>
      <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>Este diretório mostra somente especialistas aprovados. Contatos pessoais não são exibidos.</Text>
      <TextInput accessibilityLabel="Buscar especialista" value={query} onChangeText={setQuery} placeholder="Buscar especialista" placeholderTextColor={COLORS.muted} returnKeyType="search" style={{ minHeight: 48, backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, marginTop: 18, color: COLORS.ink }} />
      <Text style={{ color: COLORS.ink, fontWeight: '800', fontSize: 12, marginTop: 16 }}>Disponibilidade</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>{filters.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: availability === item }} onPress={() => setAvailability(item)} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 22, backgroundColor: availability === item ? COLORS.ink : COLORS.surface, borderWidth: 1, borderColor: availability === item ? COLORS.ink : COLORS.border }}><Text style={{ color: availability === item ? COLORS.surface : COLORS.text, fontWeight: '800', fontSize: 12 }}>{item}</Text></Pressable>)}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{([[regions, region, setRegion], [specialties, specialty, setSpecialty], [teams, team, setTeam]] as const).map(([options, selected, setter], index) => <View key={index} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{options.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: selected === item }} onPress={() => setter(item)} style={{ minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 12, backgroundColor: selected === item ? COLORS.redSoft : COLORS.surface, borderWidth: 1, borderColor: selected === item ? COLORS.red : COLORS.border }}><Text style={{ color: selected === item ? COLORS.redDark : COLORS.muted, fontSize: 11, fontWeight: '800' }}>{item}</Text></Pressable>)}</View>)}</View>
      {loading ? <View accessibilityRole="progressbar" style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={COLORS.red} /><Text style={{ color: COLORS.muted, marginTop: 10 }}>Carregando especialistas autorizados…</Text></View> : error ? <Card style={{ marginTop: 14 }}><Text accessibilityRole="alert" style={{ color: COLORS.redDark, lineHeight: 19 }}>{error}</Text><PrimaryButton onPress={() => void refresh()} style={{ marginTop: 12 }}>Tentar novamente</PrimaryButton></Card> : visiblePeople.length === 0 ? <Card style={{ marginTop: 14, alignItems: 'center', paddingVertical: 28 }}><Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: '900' }}>{people.length ? 'Nenhum resultado para esses filtros' : 'Nenhum especialista listado ainda'}</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 7 }}>{people.length ? 'Altere a busca ou remova filtros para ver outros perfis.' : 'Perfis aprovados aparecem aqui quando a gestão habilita o diretório.'}</Text></Card> : visiblePeople.map((person) => <Card key={person.user_id} style={{ marginTop: 12, padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={person.display_name} uri={person.avatar_url} size={48} /><View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 16 }}>{person.display_name || 'Especialista Verisure'}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>{[person.region, person.team_name].filter(Boolean).join(' · ') || 'Região e equipe não informadas'}</Text></View></View>
        <Text style={{ color: COLORS.text, fontSize: 12, lineHeight: 18, marginTop: 12 }}>Especialidades: {person.specialties.length ? person.specialties.join(', ') : 'Não informadas'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}><Text style={{ color: person.availability === 'available' ? COLORS.success : COLORS.muted, fontSize: 11, fontWeight: '800' }}>{availabilityLabel[person.availability]}</Text><Text style={{ color: COLORS.muted, fontSize: 10 }}>{person.last_seen_at ? `Último acesso ${new Date(person.last_seen_at).toLocaleDateString('pt-BR')}` : 'Último acesso não disponível'}</Text></View>
        <PrimaryButton accessibilityLabel={`Conversar com ${person.display_name}`} onPress={() => router.push({ pathname: '/chat', params: { specialistId: person.user_id, specialistName: person.display_name || 'Especialista' } })} style={{ marginTop: 12 }}>Conversar</PrimaryButton>
      </Card>)}
      <Text style={{ color: COLORS.muted, fontSize: 10, lineHeight: 15, marginTop: 16 }}>Seu perfil: {profile.name}. Apenas dados de colaboração informados pelo próprio especialista são exibidos.</Text>
    </ScrollView>
  </Screen>;
}
