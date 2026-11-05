import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { COLORS, useApp } from '@/lib/app-context';

export default function TabLayout() {
  const { unreadCount } = useApp();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: COLORS.red,
      tabBarInactiveTintColor: COLORS.muted,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '800', marginTop: 3 },
      tabBarStyle: { height: 78, paddingTop: 9, paddingBottom: 9, borderTopWidth: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: COLORS.surface, elevation: 12, shadowColor: '#1A263A', shadowOpacity: 0.09, shadowRadius: 16, shadowOffset: { width: 0, height: -5 } },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Painel', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={25} /> }} />
      <Tabs.Screen name="study" options={{ title: 'Novo estudo', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} tintColor={color} size={25} /> }} />
      <Tabs.Screen name="studies" options={{ title: 'Meus estudos', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'checklist', android: 'checklist', web: 'checklist' }} tintColor={color} size={25} /> }} />
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
