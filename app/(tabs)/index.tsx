import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar, Card, Header, Metric, PrimaryButton, ProductImage, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { supabase } from '@/lib/supabase';

const kitImage = require('../../assets/equipment/00-kit-verisure.webp');

const shortcuts = [
  { title: 'Novo estudo', description: 'Avalie o imóvel e registre os acessos.', route: '/study', icon: '＋' },
  { title: 'Meus estudos', description: 'Consulte rascunhos e propostas salvas.', route: '/studies', icon: '▤' },
  { title: 'Criar proposta', description: 'Monte uma proposta com itens e valores livres.', route: '/create-proposal', icon: 'R$' },
  { title: 'Catálogo', description: 'Veja kits e equipamentos disponíveis.', route: '/catalog', icon: '⌂' },
  { title: 'Equipe', description: 'Converse com gestão e especialistas.', route: '/chat', icon: '◌' },
] as const;

export default function DashboardScreen() {
  const { profile, studies, studiesStatus } = useApp();
  const [discountLimits, setDiscountLimits] = useState<{ equipment: number; monthly: number } | null>(null);
  useEffect(() => { if (supabase) void supabase.from('commercial_settings').select('equipment_discount_limit,monthly_discount_limit').eq('singleton', true).maybeSingle().then(({ data }) => { if (data) setDiscountLimits({ equipment: Number(data.equipment_discount_limit), monthly: Number(data.monthly_discount_limit) }); }); }, []);

  return (
    <Screen>
      <Header eyebrow="VISÃO GERAL" title="Painel" right={<Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => router.push('/profile')}><Avatar name={profile.name} uri={profile.avatarUrl} size={40} /></Pressable>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 8, marginBottom: 20 }}>
          <Text style={{ color: '#70747C', fontSize: 13 }}>Bem-vindo(a),</Text>
          <Text numberOfLines={1} style={{ color: '#17191D', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 3 }}>{profile.name || 'Especialista'}</Text>
        </View>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ height: 156, backgroundColor: '#F8F1F3', alignItems: 'center', justifyContent: 'center' }}>
            <ProductImage source={kitImage} label="Kit completo Verisure" style={{ width: '92%', height: 150 }} />
            <View style={{ position: 'absolute', top: 12, left: 14, backgroundColor: COLORS.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ color: COLORS.red, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>ESTUDO DE SEGURANÇA</Text>
            </View>
          </View>
          <View style={{ padding: 19 }}>
            <Text style={{ color: '#17191D', fontSize: 21, lineHeight: 27, fontWeight: '800', letterSpacing: -0.4 }}>Transforme a avaliação em uma proposta clara.</Text>
            <Text style={{ color: '#70747C', fontSize: 13, lineHeight: 20, marginTop: 7 }}>Registre o imóvel, avalie os acessos e apresente uma solução personalizada.</Text>
            <PrimaryButton onPress={() => router.push('/study')} style={{ marginTop: 16, alignSelf: 'flex-start' }}>Começar novo estudo</PrimaryButton>
          </View>
        </Card>

        <View style={{ marginTop: 23 }}>
          <SectionLabel>Resumo da atividade</SectionLabel>
          <Card style={{ marginTop: 10, paddingVertical: 16, flexDirection: 'row' }}>
            <Metric value={String(studies.length).padStart(2, '0')} label={studiesStatus === 'offline' ? 'estudos neste aparelho' : 'estudos salvos'} />
            <Metric value={discountLimits ? `${discountLimits.equipment}%` : '—'} label="limite em equipamentos" />
            <View style={{ flex: 1, paddingHorizontal: 12 }}><Text style={{ color: '#17191D', fontSize: 22, fontWeight: '800' }}>{discountLimits ? `${discountLimits.monthly}%` : '—'}</Text><Text style={{ color: '#737780', fontSize: 10, marginTop: 4 }}>limite mensal</Text></View>
          </Card>
        </View>

        <View style={{ marginTop: 24, marginBottom: 10 }}>
          <SectionLabel>Acesso rápido</SectionLabel>
        </View>
        <FlatList
          data={shortcuts}
          scrollEnabled={false}
          keyExtractor={(item) => item.route}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push(item.route)} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.78 }]}>
              <Card style={{ height: 126, padding: 14 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#FFF0F3', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.red, fontSize: 20, fontWeight: '700' }}>{item.icon}</Text></View>
                <Text style={{ color: '#17191D', fontSize: 14, fontWeight: '800', marginTop: 10 }}>{item.title}</Text>
                <Text style={{ color: '#737780', fontSize: 11, lineHeight: 15, marginTop: 3 }}>{item.description}</Text>
              </Card>
            </Pressable>
          )}
        />

        <View style={{ marginTop: 24 }}>
          <SectionLabel>Etapas do estudo</SectionLabel>
          <Card style={{ marginTop: 10, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {['Cliente', 'Imóvel', 'Solução', 'Proposta'].map((label, index) => <View key={label} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: index === 0 ? COLORS.red : '#F0F1F3', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: index === 0 ? COLORS.surface : '#747982', fontSize: 11, fontWeight: '800' }}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={{ color: '#62666E', fontSize: 10, fontWeight: '700', marginTop: 7 }}>{label}</Text></View>)}
            </View>
            <Text style={{ color: '#737780', fontSize: 12, lineHeight: 18, marginTop: 14, textAlign: 'center' }}>Um fluxo simples para preparar estudos completos e consistentes.</Text>
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
