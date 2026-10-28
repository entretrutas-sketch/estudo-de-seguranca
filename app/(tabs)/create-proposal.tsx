import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card, Header, PrimaryButton, ProductImage, Screen, SecondaryButton, SectionLabel, styles } from '@/components/mobile-ui';
import { COLORS, EQUIPMENT, money, type ClientDraft, type ProposalEquipmentLine, type SavedStudy, useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';
import { buildWhatsAppMessage } from '@/lib/proposal-document';
import { prepareProposalDocument, proposalImageModule } from '@/lib/proposal-renderer';
import { calculateProposalTotals, discountLimitsExceeded, parseBrazilianAmount } from '@/lib/proposal-calculation';

type CatalogKit = { kit_name: string; equipment_amount: number; monthly_amount: number; equipment_discount_limit: number; monthly_discount_limit: number; kit_composition: ProposalEquipmentLine[] };
type Product = { name: string; image: string; description: string; kind: string; place: string };
const products: Product[] = [
  ...EQUIPMENT.map((item) => ({ name: item.name, image: item.image, description: item.description, kind: item.kind, place: item.place })),
  { name: 'Câmera de Segurança', image: '01-camera-seguranca.webp', description: 'Monitoramento visual de áreas estratégicas.', kind: 'Físico', place: 'Área definida no estudo' },
  { name: 'Videodetector Externo', image: '03-videodetector-externo.webp', description: 'Verificação visual de aproximações e acessos externos.', kind: 'Físico', place: 'Fachada, garagem ou acesso externo' },
];
const blankClient: ClientDraft = { name: '', phone: '', locationName: '', street: '', addressNumber: '', complement: '', neighborhood: '', city: '', state: '', postalCode: '', propertyType: '' };
const parsePercent = (value: string) => value.trim() === '' ? 0 : Number(value.replace(',', '.'));
const newProposalId = () => `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'decimal-pad' | 'email-address' | 'phone-pad'; multiline?: boolean }) {
  return <View style={{ marginTop: 12 }}><Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800' }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A9A1A4" keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, paddingHorizontal: 14, minHeight: multiline ? 84 : 48, marginTop: 7, color: COLORS.ink, fontSize: 14, paddingTop: multiline ? 12 : 0 }} /></View>;
}

export default function CreateProposalScreen() {
  const { profile } = useApp();
  const [catalog, setCatalog] = useState<CatalogKit[]>([]);
  const [limits, setLimits] = useState({ equipment: 0, monthly: 0 });
  const [globalLimits, setGlobalLimits] = useState({ equipment: 0, monthly: 0 });
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [catalogMessage, setCatalogMessage] = useState('');
  const [kitName, setKitName] = useState('Composição personalizada');
  const [client, setClient] = useState<ClientDraft>(blankClient);
  const [specialistPhone, setSpecialistPhone] = useState('');
  const [equipmentGrossInput, setEquipmentGrossInput] = useState('');
  const [equipmentDiscountInput, setEquipmentDiscountInput] = useState('0');
  const [monthlyGrossInput, setMonthlyGrossInput] = useState('');
  const [monthlyDiscountInput, setMonthlyDiscountInput] = useState('0');
  const [notes, setNotes] = useState('');
  const [additionalLines, setAdditionalLines] = useState<ProposalEquipmentLine[]>([]);
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');
  const [stage, setStage] = useState<'edit' | 'review' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<SavedStudy | null>(null);
  const [proposalHtml, setProposalHtml] = useState('');
  const [proposalId, setProposalId] = useState(newProposalId);

  useEffect(() => {
    let active = true;
    if (!supabase) { setCatalogState('offline'); setCatalogMessage('Conecte o aplicativo ao Supabase para carregar regras e emitir propostas.'); return; }
    void Promise.all([
      supabase.from('commercial_catalog').select('kit_name,equipment_amount,monthly_amount,equipment_discount_limit,monthly_discount_limit,kit_composition').eq('active', true).order('kit_name'),
      supabase.from('commercial_settings').select('equipment_discount_limit,monthly_discount_limit').eq('singleton', true).maybeSingle(),
    ]).then(([kitsResult, settingsResult]) => {
      if (!active) return;
      if (kitsResult.error || settingsResult.error || !settingsResult.data) {
        setCatalogState('offline');
        setCatalogMessage(kitsResult.error?.message ?? settingsResult.error?.message ?? 'Não foi possível carregar as regras comerciais configuradas.');
        return;
      }
      setCatalog((kitsResult.data ?? []) as CatalogKit[]);
      const settingsLimits = { equipment: Number(settingsResult.data.equipment_discount_limit), monthly: Number(settingsResult.data.monthly_discount_limit) };
      setGlobalLimits(settingsLimits);
      setLimits(settingsLimits);
      setCatalogState('ready');
    }).catch((reason: unknown) => { if (active) { setCatalogState('offline'); setCatalogMessage(reason instanceof Error ? reason.message : 'Falha ao consultar o catálogo.'); } });
    return () => { active = false; };
  }, []);

  const selectedKit = catalog.find((item) => item.kit_name === kitName);
  const baseLines = selectedKit?.kit_composition ?? [];
  const lines = [...baseLines, ...additionalLines];
  const equipmentGross = parseBrazilianAmount(equipmentGrossInput);
  const monthlyGross = parseBrazilianAmount(monthlyGrossInput);
  const equipmentDiscount = parsePercent(equipmentDiscountInput);
  const monthlyDiscount = parsePercent(monthlyDiscountInput);
  const invalidDiscount = discountLimitsExceeded(equipmentDiscount, monthlyDiscount, limits);
  const totals = useMemo(() => calculateProposalTotals(equipmentGross ?? 0, equipmentDiscount || 0, monthlyGross ?? 0, monthlyDiscount || 0), [equipmentGross, equipmentDiscount, monthlyGross, monthlyDiscount]);

  const selectKit = (name: string) => {
    setKitName(name);
    const row = catalog.find((item) => item.kit_name === name);
    if (row) {
      setAdditionalLines([]);
      setEquipmentGrossInput(Number(row.equipment_amount).toFixed(2).replace('.', ','));
      setMonthlyGrossInput(Number(row.monthly_amount).toFixed(2).replace('.', ','));
      setLimits({ equipment: Number(row.equipment_discount_limit), monthly: Number(row.monthly_discount_limit) });
    } else {
      setAdditionalLines([]);
      setEquipmentGrossInput('');
      setMonthlyGrossInput('');
      setLimits(globalLimits);
    }
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const addProduct = (product: Product) => {
    setAdditionalLines((current) => {
      const found = current.findIndex((line) => line.name === product.name);
      if (found >= 0) return current.map((line, index) => index === found ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { ...product, quantity: 1 }];
    });
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const changeQuantity = (index: number, delta: number) => setAdditionalLines((current) => current.flatMap((line, position) => {
    const additionalIndex = index - baseLines.length;
    if (additionalIndex < 0) return [line];
    if (position !== additionalIndex) return [line];
    const quantity = line.quantity + delta;
    return quantity > 0 ? [{ ...line, quantity }] : [];
  }));

  const addCustomItem = () => {
    const quantity = Number(customQuantity);
    if (!customName.trim() || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) { Alert.alert('Item incompleto', 'Informe uma descrição e uma quantidade inteira entre 1 e 999.'); return; }
    setAdditionalLines((current) => [...current, { name: customName.trim(), quantity, description: customDescription.trim() || 'Item personalizado conforme especificação do especialista.', kind: 'Personalizado', place: 'Local definido com o cliente', image: '' }]);
    setCustomName(''); setCustomDescription(''); setCustomQuantity('1');
  };

  const validate = () => {
    if (!client.name.trim()) return 'Informe o nome do cliente.';
    if (!profile.name.trim() || !profile.email.trim()) return 'O perfil precisa ter nome e e-mail do especialista.';
    if (catalogState !== 'ready') return 'O catálogo e as regras comerciais precisam estar disponíveis online.';
    if (!equipmentGrossInput.trim() || equipmentGross === null || equipmentGross < 0) return 'Informe um valor bruto válido para os equipamentos.';
    if (!monthlyGrossInput.trim() || monthlyGross === null || monthlyGross < 0) return 'Informe uma mensalidade bruta válida.';
    if (invalidDiscount) return 'Para condições acima do limite comercial, fale com o gerente da região.';
    if (!lines.length) return 'Adicione pelo menos um equipamento ou item personalizado.';
    if (lines.length > 40) return 'A proposta aceita até 40 tipos de item.';
    return '';
  };

  const preparePdf = async (study: SavedStudy) => {
    const result = await prepareProposalDocument(study);
    setProposalHtml(result.html);
  };

  const saveProposal = async () => {
    const validation = validate();
    if (validation) { setError(validation); return; }
    if (!supabase || equipmentGross === null || monthlyGross === null) return;
    setError(''); setSaving(true);
    const payload = {
      client: { ...client, name: client.name.trim() },
      specialist: { name: profile.name, email: profile.email, phone: specialistPhone.trim(), avatarUrl: profile.avatarUrl },
      evaluation: { notes: notes.trim() },
      kit: kitName,
      equipmentGross,
      equipmentDiscount,
      monthlyGross,
      monthlyDiscount,
      customItems: additionalLines,
    };
    try {
      const { data, error: problem } = await supabase.rpc('create_custom_proposal', { p_id: proposalId, p_data: payload });
      if (problem) throw problem;
      const result = data as { studyId: string; createdAt: string; data: Record<string, unknown> };
      const proposal = { ...result.data, id: result.studyId, createdAt: result.createdAt, synced: true } as unknown as SavedStudy;
      setCreated(proposal);
      setStage('preview');
      await preparePdf(proposal);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar e calcular a proposta no servidor.');
    } finally { setSaving(false); }
  };

  const printPdf = async () => {
    if (!proposalHtml) return;
    setSaving(true);
    try {
      await Print.printAsync({ html: proposalHtml });
      if (Platform.OS !== 'web') Alert.alert('Proposta pronta', 'A visualização de impressão foi aberta.');
    } catch (reason) { Alert.alert('Falha ao gerar PDF', reason instanceof Error ? reason.message : 'Tente novamente.'); }
    finally { setSaving(false); }
  };

  const sharePdf = async () => {
    if (!proposalHtml || !created) return;
    setSaving(true);
    try {
      if (Platform.OS === 'web') { await Print.printAsync({ html: proposalHtml }); Alert.alert('PDF pronto', 'Use a opção “Salvar como PDF” na janela de impressão.'); }
      else {
        const file = await Print.printToFileAsync({ html: proposalHtml });
        if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar proposta comercial' }); Alert.alert('Compartilhamento aberto', 'Escolha WhatsApp ou outro destino e confirme o envio no aplicativo.'); }
        else await Print.printAsync({ uri: file.uri });
      }
    } catch (reason) { Alert.alert('Falha ao compartilhar', reason instanceof Error ? reason.message : 'Tente novamente.'); }
    finally { setSaving(false); }
  };

  const copyMessage = async () => {
    if (!created) return;
    await Clipboard.setStringAsync(buildWhatsAppMessage(created, lines));
    Alert.alert('Mensagem copiada', 'Revise o conteúdo antes de enviar pelo WhatsApp.');
  };

  const editProposal = () => { setStage('edit'); setCreated(null); setProposalHtml(''); setError(''); setProposalId(newProposalId()); };

  return <Screen>
    <Header title="Criar proposta comercial" right={stage === 'preview' ? null : <Text style={{ color: COLORS.red, fontWeight: '900' }}>{stage === 'edit' ? '1/2' : '2/2'}</Text>} />
    {stage === 'preview' && created ? <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}>
      <SectionLabel>PROPOSTA REGISTRADA</SectionLabel>
      <Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: '900', marginTop: 6 }}>Revisão final</Text>
      {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.red, marginTop: 12 }}>{error}</Text>}
      <Card style={{ marginTop: 14 }}><Text style={{ color: COLORS.red, fontWeight: '900', fontSize: 11 }}>CLIENTE</Text><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 5 }}>{created.client.name}</Text>{created.client.locationName ? <Text style={{ color: COLORS.muted, marginTop: 3 }}>{created.client.locationName}</Text> : null}<Text style={{ color: COLORS.muted, marginTop: 8 }}>Responsável: {created.specialist?.name} · {created.specialist?.email}</Text><Text style={{ color: COLORS.muted, marginTop: 4 }}>Emissão: {new Date(created.issuedAt ?? created.createdAt).toLocaleString('pt-BR')}</Text></Card>
      <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: '900' }}>{created.kit}</Text>{lines.map((line, index) => <View key={`${line.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 9, paddingTop: 9 }}>{line.image ? <ProductImage source={proposalImageModule(line.image)} label={line.name} style={{ width: 52, height: 46 }}/> : null}<View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontWeight: '800', fontSize: 12 }}>{line.quantity} × {line.name}</Text><Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 2 }}>{line.description}</Text><Text style={{ color: COLORS.muted, fontSize: 10 }}>{line.place}</Text></View></View>)}</Card>
      <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.muted }}>Equipamentos · bruto {money(created.equipmentOriginal ?? 0)} · desconto {created.equipmentDiscount ?? 0}%</Text><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 7 }}>Total final {money(created.finalEquipment)}</Text><Text style={{ color: COLORS.muted, marginTop: 12 }}>Mensalidade · bruto {money(created.monthlyOriginal ?? 0)} · desconto {created.monthlyDiscount ?? 0}%</Text><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 7 }}>Mensalidade final {money(created.finalMonthly)}</Text><Text style={{ color: COLORS.redDark, fontSize: 11, lineHeight: 16, marginTop: 12 }}>Condição válida exclusivamente na data de emissão; os valores e a composição poderão mudar no dia seguinte.</Text></Card>
      {proposalHtml ? <><PrimaryButton onPress={() => void printPdf()} disabled={saving} style={{ marginTop: 14 }}>{saving ? 'Preparando…' : 'Visualizar / salvar PDF'}</PrimaryButton><SecondaryButton onPress={() => void sharePdf()} disabled={saving} style={{ marginTop: 9 }}>Compartilhar PDF</SecondaryButton><SecondaryButton onPress={() => void copyMessage()} style={{ marginTop: 9 }}>Copiar mensagem para WhatsApp</SecondaryButton></> : <PrimaryButton onPress={() => created && void preparePdf(created).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Falha ao preparar PDF.'))} style={{ marginTop: 14 }}>Preparar PDF novamente</PrimaryButton>}
      <SecondaryButton onPress={editProposal} style={{ marginTop: 10 }}>Voltar e editar proposta</SecondaryButton><SecondaryButton onPress={() => router.replace('/proposals')} style={{ marginTop: 10 }}>Ver propostas salvas</SecondaryButton>
    </ScrollView> : <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
      <SectionLabel>{stage === 'edit' ? 'DADOS E COMPOSIÇÃO' : 'CONFIRA ANTES DE EMITIR'}</SectionLabel>
      <Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: '900', marginTop: 6 }}>{stage === 'edit' ? 'Monte a solução para o cliente' : 'Revise os itens e os valores'}</Text>
      <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>Você pode combinar um kit, equipamentos adicionais e itens personalizados. Os preços são consolidados.</Text>
      {catalogState === 'loading' ? <ActivityIndicator color={COLORS.red} style={{ marginTop: 20 }}/> : catalogState === 'offline' ? <Card style={{ marginTop: 12 }}><Text accessibilityRole="alert" style={{ color: COLORS.redDark }}>{catalogMessage}</Text></Card> : null}
      {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontWeight: '800', marginTop: 12 }}>{error}</Text>}
      {stage === 'edit' ? <>
        <Card style={{ marginTop: 14 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 15 }}>Cliente e responsável</Text><Field label="Nome completo do cliente *" value={client.name} onChangeText={(name) => setClient((current) => ({ ...current, name }))} placeholder="Nome do cliente"/><Field label="Telefone do cliente" value={client.phone} onChangeText={(phone) => setClient((current) => ({ ...current, phone }))} placeholder="(00) 00000-0000" keyboardType="phone-pad"/><Field label="Nome do local" value={client.locationName} onChangeText={(locationName) => setClient((current) => ({ ...current, locationName }))} placeholder="Residência ou unidade"/><Field label="Endereço" value={client.street} onChangeText={(street) => setClient((current) => ({ ...current, street }))} placeholder="Rua, número, bairro, cidade e UF"/><Field label="Tipo do imóvel (opcional)" value={client.propertyType} onChangeText={(propertyType) => setClient((current) => ({ ...current, propertyType }))} placeholder="Residencial, comercial..."/><Field label="Telefone do especialista" value={specialistPhone} onChangeText={setSpecialistPhone} placeholder="(00) 00000-0000" keyboardType="phone-pad"/><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 9 }}>{profile.name} · {profile.email}</Text></Card>
        <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 15 }}>Kit de referência</Text><Pressable accessibilityRole="radio" accessibilityState={{ selected: kitName === 'Composição personalizada' }} onPress={() => selectKit('Composição personalizada')} style={({ pressed }) => [styles.secondaryButton, { marginTop: 12, borderColor: kitName === 'Composição personalizada' ? COLORS.red : COLORS.border }, pressed && styles.pressed]}><Text style={{ color: COLORS.redDark, fontWeight: '800' }}>Composição personalizada · sem kit padrão</Text></Pressable><FlatList horizontal data={catalog} keyExtractor={(item) => item.kit_name} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }} renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityState={{ selected: kitName === item.kit_name }} onPress={() => selectKit(item.kit_name)} style={({ pressed }) => [{ borderWidth: 1, borderColor: kitName === item.kit_name ? COLORS.red : COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 }, pressed && styles.pressed]}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>{item.kit_name}</Text><Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 3 }}>{money(Number(item.equipment_amount))} · {money(Number(item.monthly_amount))}/mês</Text></Pressable>}/>
          <Text style={{ color: COLORS.ink, fontWeight: '900', marginTop: 4 }}>Composição selecionada</Text>
          {lines.map((line, index) => <View key={`${line.name}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border }}><ProductImage source={proposalImageModule(line.image)} label={line.name} style={{ width: 42, height: 38 }}/><View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: '800' }}>{line.name}{index < baseLines.length ? ' · kit' : ''}</Text><Text style={{ color: COLORS.muted, fontSize: 10 }}>{line.kind} · {line.place}</Text></View>{index >= baseLines.length ? <><Pressable accessibilityRole="button" accessibilityLabel={`Diminuir ${line.name}`} onPress={() => changeQuantity(index, -1)} style={styles.menuButton}><Text style={{ color: COLORS.red, fontWeight: '900' }}>−</Text></Pressable><Text style={{ minWidth: 22, textAlign: 'center', color: COLORS.ink, fontWeight: '900' }}>{line.quantity}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Aumentar ${line.name}`} onPress={() => changeQuantity(index, 1)} style={styles.menuButton}><Text style={{ color: COLORS.red, fontWeight: '900' }}>+</Text></Pressable></> : <Text style={{ color: COLORS.ink, fontWeight: '900' }}>×{line.quantity}</Text>}</View>)}
          <Text style={{ color: COLORS.ink, fontWeight: '900', marginTop: 16 }}>Equipamentos do catálogo</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>{products.map((product) => <Pressable key={product.name} accessibilityRole="button" onPress={() => addProduct(product)} style={({ pressed }) => [{ borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: COLORS.canvas }, pressed && styles.pressed]}><Text style={{ color: COLORS.ink, fontSize: 11, fontWeight: '700' }}>+ {product.name}</Text></Pressable>)}</View>
        </Card>
        <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 15 }}>Adicionar item personalizado</Text><Field label="Descrição do item" value={customName} onChangeText={setCustomName} placeholder="Ex.: proteção de acesso técnico"/><Field label="Detalhes (opcional)" value={customDescription} onChangeText={setCustomDescription} placeholder="Função e local recomendado" multiline/><Field label="Quantidade" value={customQuantity} onChangeText={setCustomQuantity} placeholder="1" keyboardType="decimal-pad"/><SecondaryButton onPress={addCustomItem} style={{ marginTop: 12 }}>Adicionar à composição</SecondaryButton></Card>
        <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 15 }}>Condição comercial</Text><Field label="Valor bruto total dos equipamentos (R$)" value={equipmentGrossInput} onChangeText={setEquipmentGrossInput} placeholder="0,00" keyboardType="decimal-pad"/><Field label={`Desconto de equipamentos (%) · máximo ${limits.equipment}%`} value={equipmentDiscountInput} onChangeText={setEquipmentDiscountInput} placeholder="0" keyboardType="decimal-pad"/><Field label="Mensalidade bruta (R$)" value={monthlyGrossInput} onChangeText={setMonthlyGrossInput} placeholder="0,00" keyboardType="decimal-pad"/><Field label={`Desconto de mensalidade (%) · máximo ${limits.monthly}%`} value={monthlyDiscountInput} onChangeText={setMonthlyDiscountInput} placeholder="0" keyboardType="decimal-pad"/><View style={{ marginTop: 14, padding: 13, backgroundColor: COLORS.redSoft, borderRadius: 12 }}><Text style={{ color: COLORS.muted, fontSize: 11 }}>Valores finais estimados · validados novamente pelo servidor</Text><Text style={{ color: COLORS.ink, fontWeight: '900', marginTop: 5 }}>Equipamentos {money(totals.equipmentFinal)} · mensal {money(totals.monthlyFinal)}</Text></View>{invalidDiscount && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontWeight: '800', marginTop: 9 }}>Para condições acima do limite comercial, fale com o gerente da região.</Text>}<Field label="Observações do especialista (opcional)" value={notes} onChangeText={setNotes} placeholder="Contexto da proposta" multiline/></Card>
        <PrimaryButton disabled={catalogState !== 'ready'} onPress={() => { const message = validate(); setError(message); if (!message) setStage('review'); }} style={{ marginTop: 14 }}>Revisar proposta</PrimaryButton>
      </> : <>
        <Card style={{ marginTop: 14 }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>{client.name} · {kitName}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{[client.locationName, client.street, client.city, client.state].filter(Boolean).join(' · ')}</Text>{lines.map((line, index) => <Text key={`${line.name}-${index}`} style={{ color: COLORS.text, fontSize: 12, marginTop: 8 }}>{line.quantity}× {line.name} · {line.description}</Text>)}</Card>
        <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.muted }}>Equipamentos brutos: {money(equipmentGross ?? 0)}</Text><Text style={{ color: COLORS.muted, marginTop: 5 }}>Desconto de equipamentos: {equipmentDiscount}% · {money(totals.equipmentDiscountAmount)}</Text><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 5 }}>Total equipamentos: {money(totals.equipmentFinal)}</Text><Text style={{ color: COLORS.muted, marginTop: 12 }}>Mensalidade bruta: {money(monthlyGross ?? 0)}</Text><Text style={{ color: COLORS.muted, marginTop: 5 }}>Desconto mensal: {monthlyDiscount}% · {money(totals.monthlyDiscountAmount)}</Text><Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', marginTop: 5 }}>Mensalidade final: {money(totals.monthlyFinal)}</Text></Card>
        <Text style={{ color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 12 }}>Esta proposta será gravada e calculada no backend. A condição excedente aos limites não pode ser emitida sem ajuste ou aprovação comercial.</Text>
        <PrimaryButton disabled={saving || invalidDiscount} onPress={() => void saveProposal()} style={{ marginTop: 14 }}>{saving ? 'Salvando e validando…' : 'Salvar e gerar proposta PDF'}</PrimaryButton><SecondaryButton onPress={() => { setError(''); setStage('edit'); }} style={{ marginTop: 9 }}>Voltar e corrigir</SecondaryButton>
      </>}
    </ScrollView>}
  </Screen>;
}
