import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card, Header, PrimaryButton, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, money, useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';

type Proposal = { id: string; study_id: string; data: Record<string, unknown>; created_at: string };
export default function ProposalsScreen() {
  const { studies } = useApp();
  const [items, setItems] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); setError('Configure Supabase para guardar e consultar propostas.'); return; }
    setLoading(true); const { data, error: problem } = await supabase.from('proposals').select('id,study_id,data,created_at').order('created_at', { ascending: false });
    setItems(data ?? []); setError(problem?.message ?? ''); setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const generate = async (studyId: string) => { if (!supabase) return; const { error: problem } = await supabase.rpc('create_proposal', { p_study_id: studyId }); if (problem) setError(problem.message); else void refresh(); };
  return <Screen><Header title="Propostas"/><View style={{ paddingHorizontal: 20, paddingBottom: 10 }}><SectionLabel>Documentos comerciais</SectionLabel><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 7 }}>Propostas completas e condições calculadas no servidor.</Text><PrimaryButton onPress={() => router.push('/create-proposal')} style={{ marginTop: 12 }}>Criar proposta comercial</PrimaryButton></View>{loading ? <ActivityIndicator color={COLORS.red} style={{ marginTop: 24 }}/> : <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, flexGrow: 1 }} ListHeaderComponent={<>{!!error && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, marginBottom: 12 }}>{error}</Text>}{studies.filter((study) => study.synced && !items.some((proposal) => proposal.study_id === study.id)).length > 0 && <Card style={{ marginBottom: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Estudos prontos para proposta</Text>{studies.filter((study) => study.synced && !items.some((proposal) => proposal.study_id === study.id)).map((study) => <View key={study.id} style={{ marginTop: 10 }}><Text style={{ color: COLORS.muted, fontSize: 12 }}>{study.client.name} · {study.kit}</Text><PrimaryButton onPress={() => void generate(study.id)} style={{ marginTop: 7 }}>Registrar proposta</PrimaryButton></View>)}</Card>}</>} ListEmptyComponent={<Card style={{ alignItems: 'center', padding: 24 }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Nenhuma proposta emitida</Text><Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>Crie uma proposta personalizada ou finalize um estudo salvo.</Text><PrimaryButton onPress={() => router.push('/create-proposal')} style={{ marginTop: 14 }}>Criar proposta comercial</PrimaryButton></Card>} renderItem={({ item }) => { const data = item.data as { client?: { name?: string }; kit?: string; finalEquipment?: number; finalMonthly?: number }; return <Card style={{ marginBottom: 12 }}><Text style={{ color: COLORS.red, fontWeight: '900', fontSize: 10 }}>{data.kit ?? 'Proposta'}</Text><Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: '900', marginTop: 5 }}>{data.client?.name ?? 'Cliente'}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>Emitida em {new Date(item.created_at).toLocaleDateString('pt-BR')}</Text><Text style={{ color: COLORS.ink, marginTop: 8 }}>Equipamentos {money(data.finalEquipment ?? 0)} · Mensal {money(data.finalMonthly ?? 0)}</Text></Card>; }}/>}</Screen>;
}
