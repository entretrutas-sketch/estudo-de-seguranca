import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Card, Header, PrimaryButton, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, money, type SavedStudy, useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { readSecureDraft } from '@/lib/secure-draft';

type Filter = 'Todos' | 'Sincronizados' | 'Com proposta' | 'Rascunho local';
const filters: Filter[] = ['Todos', 'Sincronizados', 'Com proposta', 'Rascunho local'];

export default function StudiesScreen() {
  const { studies, studiesStatus } = useApp();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('Todos');
  const [hasDraft, setHasDraft] = useState(false);
  useEffect(() => {
    let active = true;
    void readSecureDraft(user?.id ?? 'anonymous').then((draft) => { if (active) setHasDraft(Boolean(draft)); }).catch(() => { if (active) setHasDraft(false); });
    return () => { active = false; };
  }, [user?.id]);

  const filteredStudies = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return studies.filter((study) => {
      const searchable = [study.client.name, study.client.locationName, study.client.street, study.client.neighborhood, study.client.city, study.client.state, study.kit].join(' ').toLocaleLowerCase('pt-BR');
      const matchesFilter = filter === 'Todos' || (filter === 'Sincronizados' && study.synced) || (filter === 'Com proposta' && Boolean(study.proposalVersion || study.issuedAt));
      return matchesFilter && (!normalized || searchable.includes(normalized));
    });
  }, [studies, query, filter]);

  const renderStudy = ({ item }: { item: SavedStudy }) => {
    const hasProposal = Boolean(item.proposalVersion || item.issuedAt);
    return <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}><Text style={{ color: COLORS.red, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{item.kit}</Text><Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: '900', marginTop: 5 }}>{item.client.name || 'Imóvel sem identificação'}</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{[item.client.street, item.client.addressNumber, item.client.neighborhood, item.client.city, item.client.state].filter(Boolean).join(', ') || 'Endereço ainda não informado'}</Text></View>
        <View style={{ backgroundColor: hasProposal ? '#EAF7F0' : '#EEF2F8', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 }}><Text style={{ color: hasProposal ? COLORS.success : COLORS.text, fontSize: 10, fontWeight: '900' }}>{hasProposal ? 'PROPOSTA GERADA' : item.synced ? 'SINCRONIZADO' : 'LOCAL'}</Text></View>
      </View>
      <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 14 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View><Text style={{ color: COLORS.muted, fontSize: 10 }}>Equipamentos</Text><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: '900', marginTop: 3 }}>{item.synced ? money(item.finalEquipment) : 'Aguardando validação'}</Text></View><View><Text style={{ color: COLORS.muted, fontSize: 10 }}>Mensalidade</Text><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: '900', marginTop: 3 }}>{item.synced ? money(item.finalMonthly) : 'Aguardando validação'}</Text></View><View><Text style={{ color: COLORS.muted, fontSize: 10 }}>Acessos avaliados</Text><Text style={{ color: COLORS.ink, fontSize: 13, fontWeight: '900', marginTop: 3 }}>{item.accessCounts.doors + item.accessCounts.windows + item.accessCounts.externalAccess}</Text></View></View>
      <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 12 }}>Atualizado em {new Date(item.issuedAt ?? item.createdAt).toLocaleString('pt-BR')}</Text>
    </Card>;
  };

  return <Screen><Header title="Meus estudos" right={<Text style={{ color: COLORS.red, fontWeight: '900' }}>{studies.length} estudos</Text>} />
    <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}><SectionLabel>HISTÓRICO COMERCIAL</SectionLabel><Text style={{ color: COLORS.ink, fontSize: 24, fontWeight: '900', marginTop: 8 }}>Encontre e retome um estudo</Text><Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>Pesquise cliente, local ou solução. Rascunhos locais permanecem protegidos neste aparelho.</Text>
      <TextInput accessibilityLabel="Buscar estudos" value={query} onChangeText={setQuery} placeholder="Buscar por cliente, local ou solução" placeholderTextColor={COLORS.muted} returnKeyType="search" style={{ minHeight: 48, marginTop: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, color: COLORS.ink }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{filters.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={{ minHeight: 42, borderRadius: 20, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: filter === item ? COLORS.ink : COLORS.surface, borderWidth: 1, borderColor: filter === item ? COLORS.ink : COLORS.border }}><Text style={{ color: filter === item ? COLORS.surface : COLORS.text, fontSize: 11, fontWeight: '800' }}>{item}</Text></Pressable>)}</View>
      {hasDraft && <Card style={{ marginTop: 12, padding: 13, borderLeftWidth: 4, borderLeftColor: COLORS.red }}><Text style={{ color: COLORS.redDark, fontWeight: '900' }}>RASCUNHO NESTE APARELHO</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>Rascunho protegido, pronto para continuar. A sincronização com a equipe acontece depois de salvar no servidor.</Text><PrimaryButton onPress={() => router.push('/study')} style={{ marginTop: 10 }}>Retomar estudo</PrimaryButton></Card>}
      {studiesStatus === 'loading' && <Text accessibilityLiveRegion="polite" style={{ color: COLORS.muted, fontSize: 12, marginTop: 10 }}>Carregando histórico…</Text>}
      {studiesStatus === 'offline' && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18, marginTop: 10 }}>Histórico remoto indisponível. Confira a conexão; os rascunhos locais continuam neste aparelho.</Text>}
    </View>
    <FlatList data={filteredStudies} keyExtractor={(study) => study.id} renderItem={renderStudy} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, flexGrow: 1 }} ListEmptyComponent={studiesStatus === 'loading' ? null : <Card style={{ marginTop: 12, alignItems: 'center', paddingVertical: 30 }}><Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: '900' }}>{query || filter !== 'Todos' ? 'Nenhum estudo corresponde à busca' : 'Nenhum estudo sincronizado'}</Text><Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 6 }}>{query || filter !== 'Todos' ? 'Tente outro termo ou remova filtros.' : 'Os estudos sincronizados e propostas aparecerão aqui.'}</Text>{!query && filter === 'Todos' && <PrimaryButton onPress={() => router.push('/study')} style={{ marginTop: 18 }}>Criar novo estudo</PrimaryButton>}</Card>} />
  </Screen>;
}
