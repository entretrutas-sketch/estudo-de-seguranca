import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Card, Header, ProductImage, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';

const cameraImage = require('../../assets/equipment/01-camera-seguranca.webp');

const shortcuts = [
  { title: 'Novo estudo', description: 'Inicie uma nova avaliação', route: '/study', symbol: ['plus', 'add', 'add'] },
  { title: 'Meus estudos', description: 'Acesse seus estudos salvos', route: '/studies', symbol: ['folder.fill', 'folder', 'folder'] },
  { title: 'Propostas', description: 'Consulte documentos comerciais', route: '/proposals', symbol: ['doc.text.fill', 'description', 'description'] },
  { title: 'Catálogo', description: 'Veja kits e equipamentos', route: '/catalog', symbol: ['shippingbox.fill', 'inventory_2', 'inventory_2'] },
  { title: 'Equipe', description: 'Fale com a equipe', route: '/chat', symbol: ['bubble.left.and.bubble.right.fill', 'forum', 'forum'] },
  { title: 'Condições comerciais', description: 'Consulte os limites vigentes', route: '/commercial-conditions', symbol: ['percent', 'sell', 'sell'] },
] as const;

export default function DashboardScreen() {
  const { profile, studies, studiesStatus } = useApp();
  const [discountLimits, setDiscountLimits] = useState<{ equipment: number; monthly: number } | null>(null);
  useEffect(() => { if (supabase) void supabase.from('commercial_settings').select('equipment_discount_limit,monthly_discount_limit').eq('singleton', true).maybeSingle().then(({ data }) => { if (data) setDiscountLimits({ equipment: Number(data.equipment_discount_limit), monthly: Number(data.monthly_discount_limit) }); }); }, []);
  const metrics = [
    { value: String(studies.length).padStart(2, '0'), label: studiesStatus === 'offline' ? 'estudos neste aparelho' : 'estudos salvos', symbol: ['folder.fill', 'folder', 'folder'] },
    { value: discountLimits ? `${discountLimits.equipment}%` : '—', label: 'limite em equipamentos', symbol: ['gearshape.fill', 'settings', 'settings'] },
    { value: discountLimits ? `${discountLimits.monthly}%` : '—', label: 'limite mensal', symbol: ['calendar', 'calendar_month', 'calendar_month'] },
  ] as const;

  return (
    <Screen>
      <Header eyebrow="VISÃO GERAL" title="Painel" right={<Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.push('/profile')} style={{ padding: 4, borderRadius: 28, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }}><Avatar name={profile.name} uri={profile.avatarUrl} size={42} /></Pressable>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 1, marginBottom: 17 }}>
          <Text style={{ color: COLORS.muted, fontSize: 14 }}>Bem-vindo(a),</Text>
          <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginTop: 2 }}>{profile.name || 'Especialista'}</Text>
        </View>

        <Card style={{ padding: 0, overflow: 'hidden', borderRadius: 27 }}>
          <View style={{ height: 174, backgroundColor: '#8E0625', overflow: 'hidden' }}>
            <ProductImage source={cameraImage} label="Câmera Verisure para estudo de segurança" style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            <View style={{ position: 'absolute', top: 14, left: 15, backgroundColor: COLORS.surface, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <SymbolView name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} tintColor={COLORS.red} size={16} />
              <Text style={{ color: COLORS.redDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>ESTUDO DE SEGURANÇA</Text>
            </View>
          </View>
          <View style={{ padding: 19, paddingTop: 17 }}>
            <Text style={{ color: COLORS.ink, fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.7 }}>Transforme a avaliação em uma <Text style={{ color: COLORS.red }}>proposta clara.</Text></Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>Registre o imóvel, avalie os acessos e apresente uma solução personalizada.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/study')} style={({ pressed }) => [{ minHeight: 54, marginTop: 16, borderRadius: 18, backgroundColor: COLORS.red, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: COLORS.redDark, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}>
              <Text style={{ color: COLORS.surface, fontSize: 15, fontWeight: '900' }}>Começar novo estudo</Text>
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={COLORS.surface} size={20} />
            </Pressable>
          </View>
        </Card>

        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 }}>
            <SymbolView name={{ ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' }} tintColor={COLORS.red} size={23} />
            <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 }}>Resumo da atividade</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            {metrics.map((metric) => <Card key={metric.label} style={{ flex: 1, minHeight: 132, padding: 12, borderRadius: 21 }}>
              <SymbolView name={{ ios: metric.symbol[0], android: metric.symbol[1], web: metric.symbol[2] }} tintColor={COLORS.red} size={24} />
              <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.7, marginTop: 11 }}>{metric.value}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 2 }}>{metric.label}</Text>
            </Card>)}
          </View>
        </View>

        <View style={{ marginTop: 25, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SymbolView name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }} tintColor={COLORS.red} size={22} />
            <Text style={{ color: COLORS.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 }}>Acesso rápido</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/catalog')}><Text style={{ color: COLORS.red, fontWeight: '900', fontSize: 13 }}>Ver catálogo  ›</Text></Pressable>
        </View>
        <FlatList
          data={shortcuts}
          scrollEnabled={false}
          keyExtractor={(item) => item.route}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(item.route)} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
              <Card style={{ minHeight: 91, padding: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 42, height: 42, borderRadius: 22, backgroundColor: COLORS.redSoft, alignItems: 'center', justifyContent: 'center' }}><SymbolView name={{ ios: item.symbol[0], android: item.symbol[1], web: item.symbol[2] }} tintColor={COLORS.red} size={21} /></View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 13, fontWeight: '900' }}>{item.title}</Text>
                  <Text numberOfLines={2} style={{ color: COLORS.muted, fontSize: 10, lineHeight: 14, marginTop: 3 }}>{item.description}</Text>
                </View>
              </Card>
            </Pressable>
          )}
        />

        <View style={{ marginTop: 24 }}>
          <SectionLabel>Etapas do estudo</SectionLabel>
          <Card style={{ marginTop: 11, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {['Cliente', 'Imóvel', 'Solução', 'Proposta'].map((label, index) => <View key={label} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: index === 0 ? COLORS.red : COLORS.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: index === 0 ? 0 : 1, borderColor: COLORS.border }}><Text style={{ color: index === 0 ? COLORS.surface : COLORS.muted, fontSize: 11, fontWeight: '900' }}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={{ color: COLORS.muted, fontSize: 10, fontWeight: '800', marginTop: 7 }}>{label}</Text></View>)}
            </View>
            <Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: 'center' }}>Um fluxo simples para preparar estudos completos e consistentes.</Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
