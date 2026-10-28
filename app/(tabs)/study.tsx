import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Card, Header, PrimaryButton, ProductImage, Progress, Screen, SecondaryButton, SectionLabel, styles } from '@/components/mobile-ui';
import { COLORS, EQUIPMENT, getKit, money, type ClientDraft, type EvaluationDraft, type KitName, type SavedStudy, type SpecialistDraft, useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { applyDiscount, validateDiscounts } from '@/lib/commercial-rules';
import { deleteSecureDraft, readSecureDraft, writeSecureDraft } from '@/lib/secure-draft';
import { buildWhatsAppMessage } from '@/lib/proposal-document';
import { prepareProposalDocument, proposalImageModule, proposalLinesFor } from '@/lib/proposal-renderer';

const images = {
  kit: require('../../assets/equipment/00-kit-verisure.webp'),
  camera: require('../../assets/equipment/01-camera-seguranca.webp'),
  internal: require('../../assets/equipment/02-videodetector-interno.webp'),
  external: require('../../assets/equipment/03-videodetector-externo.webp'),
  sign: require('../../assets/equipment/04-placa-inibicao.webp'),
  sensor: require('../../assets/equipment/05-sensor-abertura-presense.webp'),
  panel: require('../../assets/equipment/06-painel-controle.webp'),
  hub: require('../../assets/equipment/07-unidade-central.webp'),
  keys: require('../../assets/equipment/08-chaves-inteligentes.webp'),
  remote: require('../../assets/equipment/09-controle-remoto.webp'),
  panic: require('../../assets/equipment/10-botao-panico.webp'),
  app: require('../../assets/equipment/11-my-verisure.webp'),
} as const;
const equipmentSources: Record<string, number> = {
  'Unidade Central': images.hub, 'Painel de Controle': images.panel, 'Videodetector Interno': images.internal,
  'Sensor de abertura PreSense™': images.sensor, 'Chaves Inteligentes': images.keys, 'Controle remoto': images.remote,
  'Botão de pânico': images.panic, 'Placas de inibição': images.sign, 'MY VERISURE': images.app,
};
const blankClient: ClientDraft = { name: '', phone: '', locationName: '', street: '', addressNumber: '', complement: '', neighborhood: '', city: '', state: '', postalCode: '', propertyType: '' };
const blankEvaluation: EvaluationDraft = { accessCounts: { doors: 0, windows: 0, externalAccess: 0 }, garage: '', interiorAreas: '', notes: '', photoConsent: false, photoUris: [] };

function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'decimal-pad' }) {
  return <View style={{ marginTop: 12 }}><Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '800' }}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#A9A1A4" keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={{ backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, paddingHorizontal: 14, minHeight: multiline ? 90 : 48, marginTop: 7, color: COLORS.ink, fontSize: 14, paddingTop: multiline ? 12 : 0 }} /></View>;
}

function ProposalPreview({ study, ready, loading, error, onRetry, onPdf, onShare, onWhatsApp, onEdit, onStudies }: { study: SavedStudy; ready: boolean; loading: boolean; error: string; onRetry: () => void; onPdf: () => void; onShare: () => void; onWhatsApp: () => void; onEdit: () => void; onStudies: () => void }) {
  const lines = proposalLinesFor(study);
  const issued = new Date(study.issuedAt ?? study.createdAt);
  const address = [study.client.street, study.client.addressNumber, study.client.complement, study.client.neighborhood, study.client.city, study.client.state, study.client.postalCode].filter(Boolean).join(', ');
  return <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
    <SectionLabel>Proposta comercial · {ready ? 'pronta para apresentar' : 'estudo salvo'}</SectionLabel>
    <Text style={{ color: COLORS.ink, fontSize: 25, fontWeight: '900', marginTop: 8 }}>Estudo de Segurança</Text>
    <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 5 }}>Prévia do documento gerado com os dados validados do estudo.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 18, marginTop: 12 }}>{error}</Text>}
    <Card style={{ marginTop: 16 }}><Text style={{ color: COLORS.red, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>CLIENTE E EMISSÃO</Text><Text style={{ color: COLORS.ink, fontSize: 19, fontWeight: '900', marginTop: 7 }}>{study.client.name}</Text>{study.client.locationName.trim() ? <Text style={{ color: COLORS.ink, marginTop: 4 }}>{study.client.locationName}</Text> : null}{address ? <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }}>{address}</Text> : null}{study.client.phone.trim() ? <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{study.client.phone}</Text> : null}<View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 12 }}/><Text style={{ color: COLORS.muted, fontSize: 12 }}>Especialista: {study.specialist?.name}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 3 }}>{study.specialist?.email}{study.specialist?.phone?.trim() ? ` · ${study.specialist.phone}` : ''}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>Emissão: {issued.toLocaleDateString('pt-BR')} às {issued.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text></Card>
    <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: '900' }}>{study.kit}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Composição incluída no estudo</Text>{lines.map((line) => <View key={line.name} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 10, paddingTop: 9, gap: 10 }}>{line.image ? <ProductImage source={proposalImageModule(line.image)} label={line.name} style={{ width: 54, height: 46 }}/> : null}<View style={{ flex: 1 }}><Text style={{ color: COLORS.ink, fontSize: 12, fontWeight: '800' }}>{line.quantity} × {line.name}</Text><Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 2 }}>{line.description}</Text></View></View>)}</Card>
    <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontSize: 16, fontWeight: '900' }}>Investimento</Text>{typeof study.equipmentOriginal === 'number' && <Text style={{ color: COLORS.muted, marginTop: 10 }}>Equipamentos · bruto {money(study.equipmentOriginal)} · condição {study.equipmentDiscount ?? 0}%</Text>}<Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: '900', marginTop: 5 }}>Total final: {money(study.finalEquipment)}</Text>{typeof study.monthlyOriginal === 'number' && <Text style={{ color: COLORS.muted, marginTop: 12 }}>Mensalidade · original {money(study.monthlyOriginal)} · condição {study.monthlyDiscount ?? 0}%</Text>}<Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: '900', marginTop: 5 }}>Mensalidade final: {money(study.finalMonthly)}</Text><Text style={{ color: COLORS.redDark, fontSize: 11, lineHeight: 16, marginTop: 12 }}>Condição comercial válida somente na data de emissão ({issued.toLocaleDateString('pt-BR')}). Valores e disponibilidade podem mudar no dia seguinte.</Text></Card>
    {study.evaluation?.notes?.trim() ? <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Observações do especialista</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }}>{study.evaluation.notes}</Text></Card> : null}
    {ready ? <><PrimaryButton onPress={onPdf} disabled={loading} style={{ marginTop: 16 }}>{loading ? 'Preparando PDF…' : 'Imprimir / salvar PDF'}</PrimaryButton><SecondaryButton onPress={onWhatsApp} style={{ marginTop: 10 }}>Copiar mensagem para WhatsApp</SecondaryButton><SecondaryButton onPress={onShare} disabled={loading} style={{ marginTop: 10 }}>Compartilhar PDF</SecondaryButton></> : <PrimaryButton onPress={onRetry} disabled={loading} style={{ marginTop: 16 }}>{loading ? 'Preparando proposta…' : 'Tentar preparar proposta novamente'}</PrimaryButton>}
    <SecondaryButton onPress={onEdit} style={{ marginTop: 10 }}>Voltar para editar o estudo</SecondaryButton>
    <SecondaryButton onPress={onStudies} style={{ marginTop: 10 }}>Ver meus estudos</SecondaryButton>
  </ScrollView>;
}

export default function StudyScreen() {
  const { addStudy, profile } = useApp();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [idempotencyKey, setIdempotencyKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
  const [specialist, setSpecialist] = useState<SpecialistDraft>({ name: String(user?.user_metadata?.name ?? user?.user_metadata?.full_name ?? ''), email: profile.email, phone: '', avatarUrl: profile.avatarUrl || String(user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? '') });
  const [client, setClient] = useState(blankClient);
  const [evaluation, setEvaluation] = useState(blankEvaluation);
  const [kitName, setKitName] = useState<KitName>('KIT PROTECTION');
  const [equipmentDiscount, setEquipmentDiscount] = useState('0');
  const [monthlyDiscount, setMonthlyDiscount] = useState('0');
  const [catalogRow, setCatalogRow] = useState<{ equipment_amount: number; monthly_amount: number; equipment_discount_limit: number; monthly_discount_limit: number } | null>(null);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'offline' | 'inactive'>(supabase ? 'loading' : 'offline');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<SavedStudy | null>(null);
  const [proposalHtml, setProposalHtml] = useState('');
  const [proposalFileUri, setProposalFileUri] = useState('');
  const [proposalError, setProposalError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStorageError, setDraftStorageError] = useState('');

  useEffect(() => {
    setSpecialist((current) => ({ ...current, name: current.name || profile.name, email: current.email || profile.email, avatarUrl: profile.avatarUrl || current.avatarUrl }));
  }, [profile.name, profile.email, profile.avatarUrl]);
  const kit = getKit(kitName);
  const equipmentPct = Number(equipmentDiscount) || 0;
  const monthlyPct = Number(monthlyDiscount) || 0;
  const invalidDiscount = !catalogRow || !validateDiscounts(equipmentPct, monthlyPct, { equipment: catalogRow.equipment_discount_limit, monthly: catalogRow.monthly_discount_limit });
  const finalEquipment = catalogRow ? applyDiscount(catalogRow.equipment_amount, equipmentPct) : null;
  const finalMonthly = catalogRow ? applyDiscount(catalogRow.monthly_amount, monthlyPct) : null;

  useEffect(() => {
    void readSecureDraft(user?.id ?? 'anonymous').then((raw) => {
      if (!raw) return;
      const draft = JSON.parse(raw) as { idempotencyKey?: string; client?: ClientDraft; specialist?: SpecialistDraft; evaluation?: EvaluationDraft; kitName?: KitName; step?: number; equipmentDiscount?: string; monthlyDiscount?: string };
      if (draft.idempotencyKey) setIdempotencyKey(draft.idempotencyKey);
      if (draft.client) setClient({ ...blankClient, ...draft.client });
      if (draft.specialist) setSpecialist((current) => ({ ...current, ...draft.specialist }));
      if (draft.evaluation) setEvaluation({ ...blankEvaluation, ...draft.evaluation });
      if (draft.kitName) setKitName(draft.kitName);
      if (draft.step) setStep(draft.step);
      if (draft.equipmentDiscount) setEquipmentDiscount(draft.equipmentDiscount);
      if (draft.monthlyDiscount) setMonthlyDiscount(draft.monthlyDiscount);
      setDraftRestored(true);
    }).catch((error: unknown) => setDraftStorageError(error instanceof Error ? error.message : 'Não foi possível ler o rascunho seguro.')).finally(() => setDraftReady(true));
  }, [user?.id]);
  useEffect(() => {
    if (!draftReady || created) return;
    const timeout = setTimeout(() => { void writeSecureDraft(user?.id ?? 'anonymous', JSON.stringify({ idempotencyKey, client, specialist, evaluation, kitName, step, equipmentDiscount, monthlyDiscount })).then((saved) => { if (!saved && Platform.OS === 'web') setDraftStorageError('Rascunho não persistido na web; finalize ou mantenha esta aba aberta.'); }).catch((error: unknown) => setDraftStorageError(error instanceof Error ? error.message : 'Não foi possível gravar o rascunho seguro.')); }, 350);
    return () => clearTimeout(timeout);
  }, [user?.id, idempotencyKey, client, specialist, evaluation, kitName, step, equipmentDiscount, monthlyDiscount, draftReady, created]);
  useEffect(() => {
    let alive = true;
    if (!supabase) return;
    void supabase.from('commercial_catalog').select('kit_name,equipment_amount,monthly_amount,equipment_discount_limit,monthly_discount_limit').eq('kit_name', kitName).eq('active', true).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) { setCatalogState('offline'); return; }
      if (!data) { setCatalogRow(null); setCatalogState('inactive'); return; }
      setCatalogRow(data); setCatalogState('ready');
    });
    return () => { alive = false; };
  }, [kitName]);

  const updateClient = (key: keyof ClientDraft, value: string) => setClient((current) => ({ ...current, [key]: value }));
  const locateAddress = async () => {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { Alert.alert('Permissão não concedida', 'Você pode continuar e preencher o endereço manualmente.'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const place = (await Location.reverseGeocodeAsync(position.coords))[0];
      if (place) setClient((value) => ({ ...value, street: place.street ?? value.street, addressNumber: place.streetNumber ?? value.addressNumber, neighborhood: place.district ?? value.neighborhood, city: place.city ?? place.subregion ?? value.city, state: place.region ?? value.state, postalCode: place.postalCode ?? value.postalCode, locationName: place.name ?? value.locationName }));
      Alert.alert('Endereço localizado', 'Revise os campos; os dados ainda podem ser editados.');
    } catch { Alert.alert('Localização indisponível', 'O endereço pode ser preenchido manualmente.'); } finally { setLocating(false); }
  };
  const pickPhotos = async () => {
    if (!evaluation.photoConsent) { Alert.alert('Consentimento necessário', 'Confirme que o cliente autorizou as fotos do imóvel.'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permissão necessária', 'Autorize o acesso às fotos ou continue sem anexos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 });
    if (!result.canceled) setEvaluation((value) => ({ ...value, photoUris: result.assets.slice(0, 5).map((asset) => asset.uri) }));
  };
  const goNext = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); setStep((value) => Math.min(5, value + 1)); };
  const goBack = () => setStep((value) => Math.max(1, value - 1));

  const save = async () => {
    if (!client.name.trim()) { Alert.alert('Dados incompletos', 'Informe o nome do cliente.'); setStep(2); return; }
    if (!specialist.name.trim() || !specialist.email.trim()) { Alert.alert('Dados incompletos', 'Informe o nome e o e-mail do especialista.'); setStep(1); return; }
    if (invalidDiscount) { Alert.alert('Limite comercial', 'Para condições acima do limite comercial, fale com o gerente da região.'); return; }
    if (!supabase) { Alert.alert('Backend não configurado', Platform.OS === 'web' ? 'Este estudo permanece apenas nesta sessão de navegador; nenhum dado foi sincronizado.' : 'O rascunho está no armazenamento seguro do dispositivo. Nenhum preço foi validado nem estudo sincronizado.'); return; }
    setSaving(true);
    let savedStudy: SavedStudy | null = null;
    try {
      const saved = await addStudy({ idempotencyKey, client, kit: kit.name, accessCounts: evaluation.accessCounts, finalEquipment: 0, finalMonthly: 0, specialist, evaluation, equipmentDiscount: equipmentPct, monthlyDiscount: monthlyPct });
      savedStudy = saved;
      setCreated(saved);
      await deleteSecureDraft(user?.id ?? 'anonymous');
      await prepareProposal(saved);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tente novamente quando houver conexão.';
      if (savedStudy) setProposalError(`O estudo foi salvo, mas a proposta não ficou pronta: ${message}`);
      else Alert.alert('Não foi possível salvar', message);
    } finally { setSaving(false); }
  };

  const itemRows = useMemo(() => EQUIPMENT.map((item) => ({ ...item, quantity: item.name === 'Sensor de abertura PreSense™' ? item.quantity + kit.extraSensors : item.quantity })), [kit]);
  const prepareProposal = async (study: SavedStudy) => {
    if (!supabase) throw new Error('Supabase precisa estar configurado para emitir a proposta.');
    setProposalError('');
    const result = await supabase.rpc('create_proposal', { p_study_id: study.id });
    if (result.error) throw result.error;
    const response = result.data as { createdAt?: string; data?: SavedStudy };
    if (!response || !response.data) throw new Error('O servidor não retornou a proposta validada.');
    const snapshot: SavedStudy = { ...study, ...response.data, id: study.id, createdAt: response.createdAt || study.createdAt, issuedAt: response.data.issuedAt || response.createdAt || study.createdAt, synced: true };
    const document = await prepareProposalDocument(snapshot);
    setCreated(snapshot);
    setProposalHtml(document.html);
    if (Platform.OS !== 'web') {
      const file = await Print.printToFileAsync({ html: document.html, base64: false });
      setProposalFileUri(file.uri);
    }
  };

  const sharePdf = async () => {
    if (!created || !proposalHtml) return;
    setSaving(true);
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html: proposalHtml });
        Alert.alert('PDF pronto', 'Na impressão, selecione “Salvar como PDF”. A proposta possui três páginas.');
      } else {
        const uri = proposalFileUri || (await Print.printToFileAsync({ html: proposalHtml, base64: false })).uri;
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar proposta PDF' });
          Alert.alert('Compartilhamento aberto', 'Escolha WhatsApp ou outro destino. O envio depende da confirmação no aplicativo escolhido.');
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch (error) {
      Alert.alert('Falha ao preparar o PDF', error instanceof Error ? error.message : 'Tente novamente.');
    } finally { setSaving(false); }
  };

  const printPdf = async () => {
    if (!created || !proposalHtml) return;
    setSaving(true);
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html: proposalHtml });
        Alert.alert('Proposta pronta', 'Na janela de impressão, escolha “Salvar como PDF”.');
      } else {
        const uri = proposalFileUri || (await Print.printToFileAsync({ html: proposalHtml, base64: false })).uri;
        await Print.printAsync({ uri });
      }
    } catch (error) { Alert.alert('Falha ao abrir o PDF', error instanceof Error ? error.message : 'Tente novamente.'); }
    finally { setSaving(false); }
  };

  const copyWhatsApp = async () => {
    if (!created || !proposalHtml) return;
    await Clipboard.setStringAsync(buildWhatsAppMessage(created, proposalLinesFor(created)));
    Alert.alert('Mensagem copiada', 'Revise os dados antes de enviar pelo WhatsApp.');
  };

  const retryProposal = async () => {
    if (!created) return;
    setSaving(true);
    try { await prepareProposal(created); }
    catch (error) { setProposalError(error instanceof Error ? error.message : 'Não foi possível preparar a proposta.'); }
    finally { setSaving(false); }
  };

  const editSavedStudy = () => {
    setCreated(null);
    setProposalHtml('');
    setProposalFileUri('');
    setProposalError('');
    setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
    setStep(5);
  };

  const accessLabels = [['doors', 'Portas'], ['windows', 'Janelas'], ['externalAccess', 'Acessos externos']] as const;
  const equipmentImagesList = [
    { name: 'Câmera de segurança', source: images.camera, description: 'Áreas internas estratégicas ou externas.' },
    { name: 'Videodetector interno', source: images.internal, description: 'Sala, hall ou circulação interna.' },
    { name: 'Videodetector externo', source: images.external, description: 'Fachada, garagem ou acesso externo.' },
    ...itemRows.map((item) => ({ name: item.name, source: equipmentSources[item.name], description: `${item.quantity} incluído(s) · ${item.kind} · ${item.place}` })),
  ];
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="Novo estudo" right={<Text style={{ color: COLORS.red, fontWeight: '900' }}>{step}/5</Text>} />
    {created ? <ProposalPreview study={created} ready={Boolean(proposalHtml)} loading={saving} error={proposalError} onRetry={() => void retryProposal()} onPdf={() => void printPdf()} onShare={() => void sharePdf()} onWhatsApp={() => void copyWhatsApp()} onEdit={editSavedStudy} onStudies={() => router.replace('/studies')}/> : <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }} keyboardShouldPersistTaps="handled"><Progress step={step} total={5}/>
    {draftRestored && <Text accessibilityRole="text" style={{ color: COLORS.muted, fontSize: 11, marginTop: 8 }}>Rascunho seguro restaurado automaticamente.</Text>}{!!draftStorageError && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 11, marginTop: 8 }}>{draftStorageError}</Text>}
    {step === 1 && <View style={{ marginTop: 20 }}><SectionLabel>Etapa 1 · Especialista</SectionLabel><Text style={titleStyle}>Responsável pelo estudo</Text><Card style={{ marginTop: 14 }}><Field label="Nome" value={specialist.name} onChangeText={(value) => setSpecialist((current) => ({ ...current, name: value }))} placeholder="Nome do especialista"/><Field label="E-mail corporativo" value={specialist.email} onChangeText={(value) => setSpecialist((current) => ({ ...current, email: value }))} placeholder="nome@empresa.com" keyboardType="email-address"/><Field label="Telefone para contato" value={specialist.phone} onChangeText={(value) => setSpecialist((current) => ({ ...current, phone: value }))} placeholder="(00) 00000-0000" keyboardType="phone-pad"/><Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 10 }}>Foto de perfil oficial: {specialist.avatarUrl ? 'disponível pela conta' : 'não fornecida pela conta'}</Text></Card></View>}
    {step === 2 && <View style={{ marginTop: 20 }}><SectionLabel>Etapa 2 · Cliente e local</SectionLabel><Text style={titleStyle}>Quem vamos proteger?</Text><Card style={{ marginTop: 14 }}><Field label="Nome do cliente *" value={client.name} onChangeText={(value) => updateClient('name', value)} placeholder="Nome completo"/><Field label="Telefone" value={client.phone} onChangeText={(value) => updateClient('phone', value)} placeholder="(00) 00000-0000" keyboardType="phone-pad"/><Field label="Tipo de imóvel (opcional)" value={client.propertyType} onChangeText={(value) => updateClient('propertyType', value)} placeholder="Residencial, comercial, condomínio"/><Field label="Nome do local" value={client.locationName} onChangeText={(value) => updateClient('locationName', value)} placeholder="Unidade / residência"/><Field label="Rua" value={client.street} onChangeText={(value) => updateClient('street', value)} placeholder="Rua ou avenida"/><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="Número" value={client.addressNumber} onChangeText={(value) => updateClient('addressNumber', value)} placeholder="Nº"/></View><View style={{ flex: 1 }}><Field label="Complemento" value={client.complement} onChangeText={(value) => updateClient('complement', value)} placeholder="Casa, bloco"/></View></View><Field label="Bairro" value={client.neighborhood} onChangeText={(value) => updateClient('neighborhood', value)} placeholder="Bairro"/><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="Cidade" value={client.city} onChangeText={(value) => updateClient('city', value)} placeholder="Cidade"/></View><View style={{ width: 76 }}><Field label="UF" value={client.state} onChangeText={(value) => updateClient('state', value)} placeholder="UF"/></View></View><Field label="CEP (opcional)" value={client.postalCode} onChangeText={(value) => updateClient('postalCode', value)} placeholder="00000-000" keyboardType="phone-pad"/><Pressable accessibilityRole="button" onPress={() => void locateAddress()} style={{ minHeight: 48, borderWidth: 1, borderColor: COLORS.red, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14 }}>{locating ? <ActivityIndicator color={COLORS.red}/> : <Text style={{ color: COLORS.red, fontWeight: '900' }}>Usar minha localização</Text>}</Pressable></Card></View>}
    {step === 3 && <View style={{ marginTop: 20 }}><SectionLabel>Etapa 3 · Avaliação</SectionLabel><Text style={titleStyle}>Avalie os acessos do imóvel</Text><Text style={{ color: COLORS.muted, marginTop: 6 }}>A recomendação não substitui vistoria técnica.</Text><Card style={{ marginTop: 14 }}>{accessLabels.map(([key, label]) => <View key={key} style={rowStyle}><Text style={{ flex: 1, color: COLORS.ink, fontWeight: '800' }}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Diminuir ${label}`} onPress={() => setEvaluation((value) => ({ ...value, accessCounts: { ...value.accessCounts, [key]: Math.max(0, value.accessCounts[key] - 1) } }))} style={counterStyle}><Text>−</Text></Pressable><Text style={{ width: 34, textAlign: 'center', fontWeight: '900' }}>{evaluation.accessCounts[key]}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Aumentar ${label}`} onPress={() => setEvaluation((value) => ({ ...value, accessCounts: { ...value.accessCounts, [key]: value.accessCounts[key] + 1 } }))} style={[counterStyle, { backgroundColor: COLORS.red }]}><Text style={{ color: 'white' }}>+</Text></Pressable></View>)}<Field label="Garagem / acesso veicular" value={evaluation.garage} onChangeText={(value) => setEvaluation((current) => ({ ...current, garage: value }))} placeholder="Descreva o acesso"/><Field label="Áreas internas relevantes" value={evaluation.interiorAreas} onChangeText={(value) => setEvaluation((current) => ({ ...current, interiorAreas: value }))} placeholder="Sala, hall, corredores…"/><Field label="Observações do especialista" value={evaluation.notes} onChangeText={(value) => setEvaluation((current) => ({ ...current, notes: value }))} placeholder="Pontos de atenção, sem prometer cobertura" multiline/><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: evaluation.photoConsent }} onPress={() => setEvaluation((value) => ({ ...value, photoConsent: !value.photoConsent }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 }}><Text style={{ color: COLORS.red, fontSize: 18 }}>{evaluation.photoConsent ? '☑' : '□'}</Text><Text style={{ flex: 1, color: COLORS.text, fontSize: 12 }}>Tenho consentimento do cliente para selecionar fotos do imóvel.</Text></Pressable><SecondaryButton onPress={() => void pickPhotos()} style={{ marginTop: 12 }}>Selecionar até 5 fotos ({evaluation.photoUris.length})</SecondaryButton><Text style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>Fotos ficam no dispositivo até haver configuração de storage seguro no Supabase.</Text></Card></View>}
    {step === 4 && <View style={{ marginTop: 20 }}><SectionLabel>Etapa 4 · Solução</SectionLabel><Text style={titleStyle}>Escolha uma composição</Text><ProductImage source={images.kit} label="Imagem do kit completo Verisure" style={{ width: '100%', height: 175, marginVertical: 12 }}/><FlatList scrollEnabled={false} data={['KIT PROTECTION', 'BT4', 'BT6', 'BT8'] as KitName[]} keyExtractor={(item) => item} renderItem={({ item }) => { const value = getKit(item); return <Pressable accessibilityRole="radio" accessibilityState={{ selected: kitName === item }} onPress={() => { setKitName(item); void Haptics.selectionAsync().catch(() => undefined); }} style={[styles.card, { marginBottom: 10, borderColor: kitName === item ? COLORS.red : COLORS.border, borderWidth: kitName === item ? 2 : 1 }]}><Text style={{ fontWeight: '900', color: COLORS.ink }}>{item}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{value.description} {item !== 'KIT PROTECTION' ? `+ ${value.extraSensors} sensores adicionais.` : ''}</Text></Pressable>; }}/><Text style={{ color: COLORS.muted, fontSize: 12, marginVertical: 6 }}>Composição consultiva; valide os pontos na vistoria. MY VERISURE é aplicativo, placas são sinalização.</Text><FlatList scrollEnabled={false} data={equipmentImagesList} keyExtractor={(item, index) => `${item.name}-${index}`} numColumns={2} columnWrapperStyle={{ gap: 10 }} renderItem={({ item }) => <Card style={{ flex: 1, padding: 10, marginBottom: 10 }}><ProductImage source={item.source} label={item.name} style={{ width: '100%', height: 96 }}/><Text style={{ fontWeight: '900', color: COLORS.ink, fontSize: 12, marginTop: 6 }}>{item.name}</Text><Text style={{ color: COLORS.muted, fontSize: 10, marginTop: 3 }}>{item.description}</Text></Card>}/></View>}
    {step === 5 && <View style={{ marginTop: 20 }}><SectionLabel>Etapa 5 · Condição comercial</SectionLabel><Text style={titleStyle}>Revise e salve o estudo</Text><Card style={{ marginTop: 14 }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>{client.name || 'Cliente ainda não informado'} · {kit.name}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{[client.street, client.addressNumber, client.city, client.state].filter(Boolean).join(', ') || 'Endereço incompleto'}</Text><Field label={`Desconto de equipamentos (máx. ${catalogRow?.equipment_discount_limit ?? '—'}%)`} value={equipmentDiscount} onChangeText={setEquipmentDiscount} placeholder="0" keyboardType="decimal-pad"/><Field label={`Desconto mensal (máx. ${catalogRow?.monthly_discount_limit ?? '—'}%)`} value={monthlyDiscount} onChangeText={setMonthlyDiscount} placeholder="0" keyboardType="decimal-pad"/><View style={{ marginTop: 16, backgroundColor: COLORS.redSoft, padding: 14, borderRadius: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '800' }}>{catalogState === 'loading' ? 'Consultando catálogo do servidor…' : catalogState === 'ready' ? `Equipamentos: ${money(finalEquipment ?? 0)} · Mensal: ${money(finalMonthly ?? 0)}` : catalogState === 'inactive' ? 'Preço deste kit sem ativação no catálogo. Solicite configuração à gestão.' : 'Sem conexão com o catálogo; valores comerciais indisponíveis.'}</Text><Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 5 }}>Desconto aplicado: equipamento {equipmentPct}% · mensalidade {monthlyPct}%. Valores finais dependem da validação do servidor.</Text></View>{invalidDiscount && catalogState === 'ready' && <Text accessibilityRole="alert" style={{ color: COLORS.red, fontWeight: '800', marginTop: 10 }}>Para condições acima do limite comercial, fale com o gerente da região.</Text>}</Card><PrimaryButton disabled={saving || catalogState !== 'ready' || invalidDiscount} onPress={() => void save()} style={{ marginTop: 14 }}>{saving ? 'Validando e salvando…' : 'Finalizar estudo e preparar proposta'}</PrimaryButton><Text style={{ color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>{catalogState === 'ready' ? 'O servidor recalcula os totais antes de persistir.' : 'Você pode manter este rascunho local; não há proposta comercial sem catálogo ativo.'}</Text></View>}
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>{step > 1 && <SecondaryButton onPress={goBack} style={{ flex: 1 }}>Voltar</SecondaryButton>}{step < 5 && <PrimaryButton onPress={goNext} style={{ flex: 1 }}>Continuar</PrimaryButton>}</View>
    </ScrollView>}
  </KeyboardAvoidingView></Screen>;
}

const titleStyle = { color: COLORS.ink, fontSize: 24, fontWeight: '900' as const, marginTop: 8 };
const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border };
const counterStyle = { width: 34, height: 34, borderRadius: 17, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: COLORS.redSoft };
