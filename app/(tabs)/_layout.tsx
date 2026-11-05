import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { COLORS, useApp } from '@/lib/app-context';

export default function TabLayout() {
  const { unreadCount } = useApp();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.red,
      tabBarInactiveTintColor: COLORS.muted,
      tabBarPosition: desktop ? 'left' : 'bottom',
      tabBarVariant: desktop ? 'material' : 'uikit',
      tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon',
      tabBarLabelStyle: { fontSize: 11, fontWeight: '800', marginTop: 3 },
      tabBarStyle: { width: desktop ? 240 : undefined, height: desktop ? '100%' : 78, paddingHorizontal: desktop ? 14 : 0, paddingTop: desktop ? 24 : 9, paddingBottom: 9, borderTopWidth: 0, borderRightWidth: desktop ? 1 : 0, borderRightColor: COLORS.border, borderTopLeftRadius: desktop ? 0 : 26, borderTopRightRadius: desktop ? 0 : 26, backgroundColor: COLORS.surface, elevation: 12, shadowColor: '#1A263A', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: -5 } },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Painel', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={25} /> }} />
      <Tabs.Screen name="study" options={{ title: 'Novo estudo', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} tintColor={color} size={25} /> }} />
      <Tabs.Screen name="studies" options={{ title: 'Meus estudos', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'checklist', android: 'checklist', web: 'checklist' }} tintColor={color} size={25} /> }} />
      <Tabs.Screen name="specialists" options={{ title: 'Especialistas', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }} tintColor={color} size={25} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'Equipe', tabBarBadge: unreadCount > 0 ? unreadCount : undefined, tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'bubble.left.fill', android: 'chat', web: 'chat' }} tintColor={color} size={24} /> }} />
      <Tabs.Screen name="catalog" options={{ href: null }} />
      <Tabs.Screen name="proposals" options={{ href: null }} />
      <Tabs.Screen name="create-proposal" options={{ href: null }} />
      <Tabs.Screen name="commercial-conditions" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="access-requests" options={{ href: null }} />
    </Tabs>
  );
}
