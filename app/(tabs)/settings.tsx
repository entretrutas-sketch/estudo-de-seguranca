import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Header, Screen } from '@/components/mobile-ui';
import { COLORS } from '@/lib/app-context';

const key = '@verisure/mobile/notification-preferences';
export default function SettingsScreen() {
  const [haptics, setHaptics] = useState(true); const [sound, setSound] = useState(false);
  useEffect(() => { void AsyncStorage.getItem(key).then((raw) => { if (!raw) return; const value = JSON.parse(raw) as { haptics?: boolean; sound?: boolean }; setHaptics(value.haptics ?? true); setSound(value.sound ?? false); }).catch(() => undefined); }, []);
  const update = (next: { haptics: boolean; sound: boolean }) => { setHaptics(next.haptics); setSound(next.sound); void AsyncStorage.setItem(key, JSON.stringify(next)); };
  const toggle = (field: 'haptics' | 'sound') => update({ haptics: field === 'haptics' ? !haptics : haptics, sound: field === 'sound' ? !sound : sound });
  return <Screen><Header title="Configurações"/><View style={{ padding: 20, gap: 12 }}><Card><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Feedback</Text><Pressable accessibilityRole="switch" accessibilityState={{ checked: haptics }} onPress={() => toggle('haptics')} style={prefStyle}><Text style={{ color: COLORS.ink, flex: 1 }}>Vibração em ações importantes</Text><Text style={{ color: COLORS.red, fontWeight: '900' }}>{haptics ? 'ATIVA' : 'DESATIVADA'}</Text></Pressable><Pressable accessibilityRole="switch" accessibilityState={{ checked: sound }} onPress={() => toggle('sound')} style={prefStyle}><Text style={{ color: COLORS.ink, flex: 1 }}>Som de novas mensagens</Text><Text style={{ color: COLORS.red, fontWeight: '900' }}>{sound ? 'PERMITIDO' : 'DESATIVADO'}</Text></Pressable><Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 8 }}>O som só será reproduzido quando a integração de notificações push for configurada. Este app não simula entrega de notificações.</Text></Card><Card><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Armazenamento</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 7 }}>Rascunhos e preferências ficam neste aparelho. Tokens de sessão seguem o armazenamento de autenticação configurado no projeto.</Text></Card></View></Screen>;
}
const prefStyle = { minHeight: 48, borderBottomWidth: 1, borderBottomColor: COLORS.border, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 };
