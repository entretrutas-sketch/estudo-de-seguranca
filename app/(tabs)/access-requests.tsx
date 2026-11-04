import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { Card, Header, PrimaryButton, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type Request = { id: string; display_name: string; employee_number: string; email: string; created_at?: string };
export default function AccessRequestsScreen() {
  const { isMaster } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState('');
  const refresh = useCallback(async () => {
    if (!supabase || !isMaster) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('id,display_name,employee_number,email,created_at').eq('access_status', 'pending').order('created_at', { ascending: true });
    if (error) Alert.alert('Não foi possível carregar', error.message);
    else setRequests((data ?? []) as Request[]);
    setLoading(false);
  }, [isMaster]);
  useEffect(() => { void refresh(); }, [refresh]);
  const decide = async (request: Request, decision: 'approved' | 'rejected') => {
    if (!supabase) return;
    setBusyId(request.id);
    const { error } = await supabase.rpc('review_access_request', { p_user_id: request.id, p_decision: decision, p_reason: decision === 'rejected' ? 'Cadastro não aprovado pela gestão.' : null });
    setBusyId('');
    if (error) Alert.alert('Não foi possível concluir', error.message); else await refresh();
  };
  return <Screen><Header title="Autorizar acessos"/><ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
    <Text style={{ color: COLORS.muted, lineHeight: 20 }}>Revise os dados do especialista e aprove apenas cadastros confirmados.</Text>
    {!isMaster ? <Card><Text style={{ color: COLORS.redDark, fontWeight: '800' }}>Acesso exclusivo da conta master.</Text></Card> : loading ? <ActivityIndicator color={COLORS.red} /> : requests.length === 0 ? <Card><Text style={{ color: COLORS.ink, fontWeight: '800' }}>Nenhuma solicitação pendente.</Text></Card> : requests.map((request) => <Card key={request.id} style={{ gap: 8 }}>
      <Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: '900' }}>{request.display_name}</Text>
      <Text style={{ color: COLORS.muted }}>Matrícula: {request.employee_number || '—'}</Text><Text style={{ color: COLORS.muted }}>{request.email}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
        <PrimaryButton disabled={Boolean(busyId)} onPress={() => void decide(request, 'approved')} style={{ flex: 1 }}>{busyId === request.id ? 'Salvando…' : 'Aprovar'}</PrimaryButton>
        <PrimaryButton disabled={Boolean(busyId)} onPress={() => void decide(request, 'rejected')} style={{ flex: 1, backgroundColor: '#545963' }}>Recusar</PrimaryButton>
      </View>
    </Card>)}
  </ScrollView></Screen>;
}
