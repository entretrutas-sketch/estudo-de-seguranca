import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View, type ImageSourcePropType } from 'react-native';
import { Avatar, Card, Header, ProductImage, Screen } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { readSecureDraft } from '@/lib/secure-draft';

const cameraImage = require('../../assets/equipment/01-camera-seguranca.webp');
const quickLinks = [
  { title: 'Novo estudo', description: 'Inicie uma nova avaliação', route: '/study', ios: 'plus', other: 'add' },
  { title: 'Meus estudos', description: 'Acesse seus estudos realizados', route: '/studies', ios: 'folder.fill', other: 'folder' },
] as const;

const campaigns: { key: string; title: string; image: ImageSourcePropType }[] = [
  { key: '07', title: 'A proteção começa antes', image: require('../../assets/marketing/verisure-social-07.jpg') },
  { key: '08', title: 'Quando cada segundo conta', image: require('../../assets/marketing/verisure-social-08.jpg') },
  { key: '09', title: 'Tecnologia e monitoramento', image: require('../../assets/marketing/verisure-social-09.jpg') },
  { key: '04', title: 'Controle na sua rotina', image: require('../../assets/marketing/verisure-social-04.jpg') },
  { key: '03', title: 'Cada ponto importa', image: require('../../assets/marketing/verisure-social-03.jpg') },
];

export default function DashboardScreen() {
  const { profile, studies, studiesStatus } = useApp();
  const { user } = useAuth();
  const [draft, setDraft] = useState<{ savedAt?: string; step?: number; client?: { name?: string } } | null>(null);
  const [now, setNow] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<(typeof campaigns)[number] | null>(null);

  useEffect(() => {
    let active = true;
    void readSecureDraft(user?.id ?? 'anonymous').then((raw) => { if (active && raw) setDraft(JSON.parse(raw) as typeof draft); }).catch(() => { if (active) setDraft(null); });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => { setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(interval); }, []);

  const proposals = studies.filter((study) => Boolean(study.proposalVersion || study.issuedAt)).length;
  const evaluatedAccesses = studies.reduce((total, study) => total + study.accessCounts.doors + study.accessCounts.windows + study.accessCounts.externalAccess, 0);
  const metrics = [
    { value: studiesStatus === 'loading' ? '—' : String(studies.length), label: 'estudos sincronizados · total', ios: 'folder.fill', other: 'folder' },
    { value: studiesStatus === 'loading' ? '—' : String(proposals), label: 'propostas geradas · total', ios: 'doc.text.fill', other: 'description' },
    { value: studiesStatus === 'loading' ? '—' : String(evaluatedAccesses), label: 'acessos avaliados · total', ios: 'door.left.hand.closed', other: 'door_front' },
  ] as const;

  return (
    <Screen>
      <Header eyebrow="VISÃO GERAL" title="Painel" right={
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.push('/profile')} style={{ padding: 4, borderRadius: 28, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }}>
          <Avatar name={profile.name} uri={profile.avatarUrl} size={42} />
          <View style={{ position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: 7, backgroundColor: COLORS.red, borderWidth: 2, borderColor: COLORS.surface }} />
        </Pressable>
      } />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ minHeight: 110, flexDirection: 'row', alignItems: 'center', marginTop: -4, marginBottom: 10, overflow: 'hidden' }}>
          <View style={{ flex: 1, paddingLeft: 1, zIndex: 1 }}>
            <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: '700' }}>Sua operação comercial</Text>
            <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 27, fontWeight: '900', letterSpacing: -1, marginTop: 1 }}>Visão geral</Text>
          </View>
          <View accessible={false} style={{ width: 160, height: 120, alignItems: 'center', justifyContent: 'center', marginRight: -18 }}>
            <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 100, backgroundColor: '#F8DDE3', right: -25, top: -18 }} />
            <View style={{ position: 'absolute', width: 116, height: 116, borderRadius: 80, backgroundColor: '#F4C5D0', right: 4, top: 2 }} />
            <SymbolView name={{ ios: 'shield.fill', android: 'shield', web: 'shield' }} tintColor={COLORS.red} size={92} />
            <View style={{ position: 'absolute', top: 43, right: 51, width: 38, height: 44, borderRadius: 8, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#620017', shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 }}>
              <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={COLORS.redDark} size={25} />
            </View>
          </View>
        </View>

        <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 27, marginHorizontal: -1 }}>
          <View style={{ height: 188, backgroundColor: '#8E0625', overflow: 'hidden' }}>
            <ProductImage source={cameraImage} label="Câmera Verisure para estudo de segurança" style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', top: 14, left: 14, backgroundColor: COLORS.red, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SymbolView name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} tintColor={COLORS.surface} size={17} />
              <Text style={{ color: COLORS.surface, fontSize: 10, fontWeight: '900' }}>ESTUDO DE SEGURANÇA</Text>
            </View>
            <View style={{ position: 'absolute', right: -40, bottom: -55, width: 145, height: 300, backgroundColor: COLORS.red, transform: [{ rotate: '39deg' }] }} />
          </View>
          <View style={{ padding: 17, paddingTop: 15 }}>
            <Text style={{ color: COLORS.ink, fontSize: 23, lineHeight: 27, fontWeight: '900', letterSpacing: -0.7 }}>Da avaliação à <Text style={{ color: COLORS.red }}>solução certa.</Text></Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 7 }}>Organize vulnerabilidades, equipamentos e proposta em um fluxo guiado.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/study')} style={({ pressed }) => [{ alignSelf: 'flex-start', minHeight: 48, marginTop: 13, borderRadius: 25, backgroundColor: COLORS.red, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: COLORS.redDark, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}>
              <Text style={{ color: COLORS.surface, fontSize: 14, fontWeight: '900' }}>Novo estudo</Text>
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={COLORS.surface} size={18} />
            </Pressable>
          </View>
        </Card>

        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SymbolView name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }} tintColor={COLORS.red} size={21} />
              <Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 }}>Resumo da atividade</Text>
            </View>
            <View style={{ minHeight: 34, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ color: COLORS.text, fontSize: 10, fontWeight: '700' }}>Visão geral · total</Text>
              <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor={COLORS.muted} size={14} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {metrics.map((metric) => <Card key={metric.label} style={{ flex: 1, minHeight: 113, padding: 10, borderRadius: 20 }}>
              <SymbolView name={{ ios: metric.ios, android: metric.other, web: metric.other }} tintColor={COLORS.red} size={22} />
              <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.7, marginTop: 8 }}>{metric.value}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 10, lineHeight: 13, marginTop: 1 }}>{metric.label}</Text>
            </Card>)}
          </View>
        </View>

        {draft && <Card style={{ marginTop: 18, borderLeftWidth: 4, borderLeftColor: COLORS.red }}>
          <Text style={{ color: COLORS.redDark, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>RASCUNHO LOCAL</Text>
          <Text style={{ color: COLORS.ink, fontSize: 17, fontWeight: '900', marginTop: 6 }}>{draft.client?.name ? `Retomar estudo · ${draft.client.name}` : 'Retomar seu estudo'}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Etapa {draft.step ?? 1} de 5 · {draft.savedAt ? `salvo ${!now || Math.floor((now - new Date(draft.savedAt).getTime()) / 60000) < 1 ? 'agora' : `há ${Math.floor((now - new Date(draft.savedAt).getTime()) / 60000)} min`}` : 'salvamento local ativo'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/study')} style={{ minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 8 }}><Text style={{ color: COLORS.red, fontWeight: '900' }}>Retomar estudo →</Text></Pressable>
        </Card>}
        {studiesStatus === 'offline' && <Card style={{ marginTop: 12, backgroundColor: '#FFF8E9', borderColor: '#E8D39A' }}><Text style={{ color: '#735100', fontWeight: '900' }}>Sincronização pendente</Text><Text style={{ color: COLORS.text, fontSize: 12, lineHeight: 18, marginTop: 4 }}>Os estudos do servidor não foram carregados. Mantenha o rascunho local e confira a conexão antes de emitir uma proposta.</Text></Card>}
        <View style={{ marginTop: 21, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SymbolView name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }} tintColor={COLORS.red} size={21} />
            <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 }}>Acesso rápido</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/catalog')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ color: COLORS.red, fontWeight: '800', fontSize: 13 }}>Ver todos</Text>
            <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={COLORS.red} size={15} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {quickLinks.map((item) => <Pressable key={item.route} accessibilityRole="button" onPress={() => router.push(item.route)} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.82 }]}>
            <Card style={{ minHeight: 78, padding: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 42, height: 42, borderRadius: 24, backgroundColor: COLORS.redSoft, alignItems: 'center', justifyContent: 'center' }}><SymbolView name={{ ios: item.ios, android: item.other, web: item.other }} tintColor={COLORS.red} size={21} /></View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 12, fontWeight: '900' }}>{item.title}</Text>
                <Text numberOfLines={2} style={{ color: COLORS.muted, fontSize: 10, lineHeight: 13, marginTop: 2 }}>{item.description}</Text>
              </View>
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={COLORS.ink} size={16} />
            </Card>
          </Pressable>)}
        </View>

        <View style={{ marginTop: 22 }}>
          <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900' }}>Atividade recente</Text>
          {studies.slice(0, 3).map((study) => <Pressable key={study.id} accessibilityRole="button" onPress={() => router.push('/studies')} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}><View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.redSoft, alignItems: 'center', justifyContent: 'center' }}><SymbolView name={{ ios: 'doc.text', android: 'description', web: 'description' }} tintColor={COLORS.red} size={18} /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: COLORS.ink, fontWeight: '800', fontSize: 13 }}>{study.client.name || 'Imóvel sem identificação'}</Text><Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 3 }}>{study.kit} · {study.synced ? 'Sincronizado' : 'Salvo neste aparelho'}</Text></View><Text style={{ color: COLORS.muted, fontSize: 10 }}>{new Date(study.createdAt).toLocaleDateString('pt-BR')}</Text></Pressable>)}
          {studies.length === 0 && studiesStatus !== 'loading' && <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 8 }}>{studiesStatus === 'offline' ? 'Sem conexão com o histórico. Seu rascunho local permanece protegido neste aparelho.' : 'Seus estudos sincronizados aparecerão aqui. Comece criando um estudo do imóvel.'}</Text>}
        </View>

        <View style={{ marginTop: 24, marginBottom: 20 }}>
          <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 }}>Segurança em foco</Text>
          <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 12 }}>Conheça soluções e dicas para proteger cada ambiente.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
            {campaigns.map((campaign) => <Pressable key={campaign.key} accessibilityRole="button" accessibilityLabel={`Ampliar imagem: ${campaign.title}`} onPress={() => setSelectedCampaign(campaign)} style={({ pressed }) => [{ width: 184, aspectRatio: 0.75, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, pressed && { opacity: 0.86 }]}>
              <Image source={campaign.image} accessible accessibilityLabel={campaign.title} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
            </Pressable>)}
          </ScrollView>
        </View>
      </ScrollView>

      <Modal visible={selectedCampaign !== null} transparent animationType="fade" onRequestClose={() => setSelectedCampaign(null)}>
        <View style={{ flex: 1, backgroundColor: '#08111FEF', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem ampliada" onPress={() => setSelectedCampaign(null)} style={{ position: 'absolute', top: 50, right: 20, zIndex: 1, width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor={COLORS.ink} size={20} />
          </Pressable>
          {selectedCampaign && <Image source={selectedCampaign.image} accessible accessibilityLabel={selectedCampaign.title} resizeMode="contain" style={{ width: '100%', height: '86%' }} />}
          {selectedCampaign && <Text style={{ color: COLORS.surface, fontSize: 14, fontWeight: '800', marginTop: 8 }}>{selectedCampaign.title}</Text>}
        </View>
      </Modal>
    </Screen>
  );
}
