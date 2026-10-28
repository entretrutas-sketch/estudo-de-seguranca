import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Card, Header, PrimaryButton, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, money } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { parseBrazilianAmount } from '@/lib/proposal-calculation';

type CatalogKit = { kit_name: string; equipment_amount: number; monthly_amount: number; equipment_discount_limit: number; monthly_discount_limit: number; active: boolean; kit_composition: unknown };
type GlobalRules = { equipment_discount_limit: number; monthly_discount_limit: number };
type Draft = { equipment: string; monthly: string; equipmentLimit: string; monthlyLimit: string; composition: string; active: boolean };
const fieldStyle = { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 12, minHeight: 44, marginTop: 6, color: COLORS.ink, fontSize: 13 } as const;
function draftFromRow(row: CatalogKit): Draft { return { equipment: Number(row.equipment_amount).toFixed(2).replace('.', ','), monthly: Number(row.monthly_amount).toFixed(2).replace('.', ','), equipmentLimit: String(row.equipment_discount_limit), monthlyLimit: String(row.monthly_discount_limit), composition: JSON.stringify(row.kit_composition ?? [], null, 2), active: row.active }; }
function AdminField({ label, value, onChangeText, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) {
  return <View style={{ marginTop: 10 }}><Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '800' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[fieldStyle, multiline && { minHeight: 150, paddingTop: 10, fontFamily: 'monospace' }]} /></View>;
}

function CatalogAdminCard({ row, onSave }: { row: CatalogKit; onSave: (row: CatalogKit, draft: Draft) => Promise<void> }) {
  const [draft, setDraft] = useState(() => draftFromRow(row));
  const [saving, setSaving] = useState(false);
  const update = (key: keyof Draft, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => { setSaving(true); try { await onSave(row, draft); } finally { setSaving(false); } };
  return <Card>
    <Text style={{ color: COLORS.red, fontWeight: '900' }}>{row.kit_name}</Text>
    <AdminField label="Valor bruto dos equipamentos (R$)" value={draft.equipment} onChangeText={(value) => update('equipment', value)} />
    <AdminField label="Mensalidade bruta (R$)" value={draft.monthly} onChangeText={(value) => update('monthly', value)} />
    <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><AdminField label="Limite equipamentos (%)" value={draft.equipmentLimit} onChangeText={(value) => update('equipmentLimit', value)} /></View><View style={{ flex: 1 }}><AdminField label="Limite mensalidade (%)" value={draft.monthlyLimit} onChangeText={(value) => update('monthlyLimit', value)} /></View></View>
    <AdminField label="Composição do kit (JSON)" value={draft.composition} onChangeText={(value) => update('composition', value)} multiline />
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.active }} onPress={() => update('active', !draft.active)} style={{ flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 12 }}><Text style={{ color: COLORS.red, fontSize: 18 }}>{draft.active ? '☑' : '□'}</Text><Text style={{ color: COLORS.ink, fontWeight: '800' }}>Kit ativo para propostas</Text></Pressable>
    <PrimaryButton disabled={saving} onPress={() => void save()} style={{ marginTop: 12 }}>{saving ? 'Salvando…' : 'Salvar alterações do kit'}</PrimaryButton>
  </Card>;
}

export default function CommercialConditionsScreen() {
  const { user } = useAuth();
  const isAdmin = ['admin', 'commercial_admin'].includes(String(user?.app_metadata?.role ?? ''));
  const [rows, setRows] = useState<CatalogKit[]>([]);
  const [rules, setRules] = useState<GlobalRules>({ equipment_discount_limit: 0, monthly_discount_limit: 0 });
  const [ruleDraft, setRuleDraft] = useState<GlobalRules>({ equipment_discount_limit: 0, monthly_discount_limit: 0 });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); setOffline(true); return; }
    setLoading(true);
    const catalogQuery = supabase.from('commercial_catalog').select('kit_name,equipment_amount,monthly_amount,equipment_discount_limit,monthly_discount_limit,active,kit_composition').order('kit_name');
    const [catalogResult, settingsResult] = await Promise.all([
      isAdmin ? catalogQuery : catalogQuery.eq('active', true),
      supabase.from('commercial_settings').select('equipment_discount_limit,monthly_discount_limit').eq('singleton', true).maybeSingle(),
    ]);
    setRows((catalogResult.data ?? []) as CatalogKit[]);
    setOffline(Boolean(catalogResult.error || settingsResult.error));
    if (settingsResult.data) { const next = { equipment_discount_limit: Number(settingsResult.data.equipment_discount_limit), monthly_discount_limit: Number(settingsResult.data.monthly_discount_limit) }; setRules(next); setRuleDraft(next); }
    setLoading(false);
  }, [isAdmin]);
  useEffect(() => { void refresh(); }, [refresh]);

  const saveKit = async (row: CatalogKit, draft: Draft) => {
    if (!supabase) return;
    const equipment = parseBrazilianAmount(draft.equipment);
    const monthly = parseBrazilianAmount(draft.monthly);
    const equipmentLimit = Number(draft.equipmentLimit.replace(',', '.'));
    const monthlyLimit = Number(draft.monthlyLimit.replace(',', '.'));
    let composition: unknown;
    try { composition = JSON.parse(draft.composition) as unknown; } catch { Alert.alert('JSON inválido', 'Revise o formato da composição e tente novamente.'); return; }
    if (equipment === null || monthly === null || equipment < 0 || monthly < 0 || !Number.isFinite(equipmentLimit) || !Number.isFinite(monthlyLimit) || equipmentLimit < 0 || equipmentLimit > 100 || monthlyLimit < 0 || monthlyLimit > 100 || !Array.isArray(composition) || composition.length > 40) {
      Alert.alert('Dados inválidos', 'Informe valores válidos, limites de 0 a 100% e uma composição em lista JSON com até 40 itens.'); return;
    }
    const { data, error } = await supabase.from('commercial_catalog').update({ equipment_amount: equipment, monthly_amount: monthly, equipment_discount_limit: equipmentLimit, monthly_discount_limit: monthlyLimit, kit_composition: composition, active: draft.active, updated_at: new Date().toISOString() }).eq('kit_name', row.kit_name).select('kit_name,equipment_amount,monthly_amount,equipment_discount_limit,monthly_discount_limit,active,kit_composition').single();
    if (error) { setMessage(error.message); Alert.alert('Não foi possível salvar', error.message); return; }
    setRows((current) => current.map((item) => item.kit_name === row.kit_name ? data as CatalogKit : item));
    setMessage(`Catálogo de ${row.kit_name} atualizado.`);
  };

  const saveRules = async () => {
    if (!supabase) return;
    if (![ruleDraft.equipment_discount_limit, ruleDraft.monthly_discount_limit].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) { Alert.alert('Limite inválido', 'Use valores de 0% a 100%.'); return; }
    setSavingRules(true);
    const { error } = await supabase.from('commercial_settings').update({ equipment_discount_limit: ruleDraft.equipment_discount_limit, monthly_discount_limit: ruleDraft.monthly_discount_limit, updated_at: new Date().toISOString() }).eq('singleton', true);
    setSavingRules(false);
    if (error) { setMessage(error.message); Alert.alert('Não foi possível salvar', error.message); return; }
    setRules(ruleDraft); setMessage('Limites gerais atualizados.');
  };

  return <Screen><Header title="Condições comerciais"/><FlatList data={rows} keyExtractor={(item) => item.kit_name} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 10 }} ListHeaderComponent={<View><SectionLabel>{isAdmin ? 'ADMINISTRAÇÃO DO CATÁLOGO' : 'LIMITES DO SERVIDOR'}</SectionLabel><Card style={{ marginTop: 12, marginBottom: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>{isAdmin ? 'Regras gerais de desconto' : 'Regras comerciais vigentes'}</Text>{isAdmin ? <><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><AdminField label="Limite geral equipamentos (%)" value={String(ruleDraft.equipment_discount_limit)} onChangeText={(value) => setRuleDraft((current) => ({ ...current, equipment_discount_limit: Number(value.replace(',', '.')) }))}/></View><View style={{ flex: 1 }}><AdminField label="Limite geral mensalidade (%)" value={String(ruleDraft.monthly_discount_limit)} onChangeText={(value) => setRuleDraft((current) => ({ ...current, monthly_discount_limit: Number(value.replace(',', '.')) }))}/></View></View><PrimaryButton disabled={savingRules} onPress={() => void saveRules()} style={{ marginTop: 12 }}>{savingRules ? 'Salvando…' : 'Salvar limites gerais'}</PrimaryButton></> : <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 19, marginTop: 8 }}>Equipamentos: até {rules.equipment_discount_limit}% · mensalidade: até {rules.monthly_discount_limit}%. O servidor valida todos os valores antes de emitir.</Text>}<Text style={{ color: offline ? COLORS.redDark : COLORS.muted, fontSize: 11, marginTop: 10 }}>{offline ? 'Catálogo indisponível. Nenhum preço será estimado.' : isAdmin ? 'As alterações ficam centralizadas no catálogo e valem para novas propostas.' : 'Valores atuais carregados do catálogo aprovado pela gestão.'}</Text>{!!message && <Text style={{ color: COLORS.success, fontSize: 11, marginTop: 8 }}>{message}</Text>}</Card>{loading && <ActivityIndicator color={COLORS.red} style={{ marginVertical: 15 }}/>}</View>} ListEmptyComponent={!loading ? <Text style={{ color: COLORS.muted, textAlign: 'center', marginTop: 24 }}>Nenhum kit ativo no catálogo.</Text> : null} renderItem={({ item }) => isAdmin ? <CatalogAdminCard row={item} onSave={saveKit}/> : <Card><Text style={{ color: COLORS.red, fontWeight: '900' }}>{item.kit_name}</Text><Text style={{ color: COLORS.ink, fontSize: 13, marginTop: 8 }}>Equipamentos: {money(Number(item.equipment_amount))}</Text><Text style={{ color: COLORS.ink, fontSize: 13, marginTop: 4 }}>Mensalidade: {money(Number(item.monthly_amount))}</Text><Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 7 }}>Limites {item.equipment_discount_limit}% / {item.monthly_discount_limit}%</Text></Card>}/></Screen>;
}
