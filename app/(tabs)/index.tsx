import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Card, Header, ProductImage, Screen } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';

const cameraImage = require('../../assets/equipment/01-camera-seguranca.webp');
const quickLinks = [
  { title: 'Novo estudo', description: 'Inicie uma nova avaliação', route: '/study', ios: 'plus', other: 'add' },
  { title: 'Meus estudos', description: 'Acesse seus estudos realizados', route: '/studies', ios: 'folder.fill', other: 'folder' },
] as const;

export default function DashboardScreen() {
  const { profile, studies, studiesStatus } = useApp();
  const [discountLimits, setDiscountLimits] = useState<{ equipment: number; monthly: number } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.from('commercial_settings').select('equipment_discount_limit,monthly_discount_limit').eq('singleton', true).maybeSingle().then(({ data }) => {
      if (data) setDiscountLimits({ equipment: Number(data.equipment_discount_limit), monthly: Number(data.monthly_discount_limit) });
    });
  }, []);

  const metrics = [
    { value: String(studies.length).padStart(2, '0'), label: studiesStatus === 'offline' ? 'estudos neste aparelho' : 'estudos salvos', ios: 'folder.fill', other: 'folder' },
    { value: discountLimits ? `${discountLimits.equipment}%` : '—', label: 'limite em equipamentos', ios: 'gearshape.fill', other: 'settings' },
    { value: discountLimits ? `${discountLimits.monthly}%` : '—', label: 'limite mensal', ios: 'calendar', other: 'calendar_month' },
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
            <Text style={{ color: COLORS.muted, fontSize: 16, fontWeight: '500' }}>Bem-vindo(a),</Text>
            <Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1, marginTop: 1 }}>{profile.name || 'Especialista'}</Text>
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
            <Text style={{ color: COLORS.ink, fontSize: 23, lineHeight: 27, fontWeight: '900', letterSpacing: -0.7 }}>Transforme a avaliação em uma <Text style={{ color: COLORS.red }}>proposta clara.</Text></Text>
            <Text style={{ color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 7 }}>Registre o imóvel, avalie os acessos e apresente uma solução personalizada.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/study')} style={({ pressed }) => [{ alignSelf: 'flex-start', minHeight: 48, marginTop: 13, borderRadius: 25, backgroundColor: COLORS.red, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: COLORS.redDark, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, pressed && { opacity: 0.82, transform: [{ scale: 0.99 }] }]}>
              <Text style={{ color: COLORS.surface, fontSize: 14, fontWeight: '900' }}>Começar novo estudo</Text>
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
              <Text style={{ color: COLORS.text, fontSize: 10, fontWeight: '700' }}>Últimos 30 dias</Text>
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
      </ScrollView>
    </Screen>
  );
}
