import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Modal, Pressable, StyleSheet, Text, View, type ImageStyle, type ImageSourcePropType, type PressableProps, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { COLORS } from '@/lib/app-context';

export function Screen({ children, ...props }: ViewProps) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}><View {...props} style={[styles.screen, props.style]}>{children}</View></SafeAreaView>;
}

const destinations = [
  ['Painel', '/'], ['Novo estudo', '/study'], ['Meus estudos', '/studies'], ['Catálogo', '/catalog'],
  ['Propostas', '/proposals'], ['Criar proposta comercial', '/create-proposal'], ['Chat da equipe', '/chat'], ['Condições comerciais', '/commercial-conditions'],
  ['Perfil do especialista', '/profile'], ['Configurações', '/settings'], ['Ajuda', '/help'],
] as const;

export function Header({ eyebrow = 'ÁREA COMERCIAL', title, right }: { eyebrow?: string; title: string; right?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu de navegação" onPress={() => setOpen(true)} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}><Text style={{ color: COLORS.red, fontSize: 21, fontWeight: '900' }}>☰</Text></Pressable>
    <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.headerTitle}>{title}</Text></View>{right}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.drawerBackdrop}><Pressable accessibilityLabel="Fechar menu" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} /><View style={styles.drawer}>
        <BrandMark /><Text style={[styles.eyebrow, { marginTop: 26, marginBottom: 8 }]}>NAVEGAÇÃO</Text>
        {destinations.map(([label, path]) => <Pressable key={path} accessibilityRole="button" accessibilityState={{ selected: pathname === path || pathname === `/(tabs)${path}` }} onPress={() => { setOpen(false); router.push(path as never); }} style={({ pressed }) => [styles.drawerLink, (pathname === path || pathname === `/(tabs)${path}`) && styles.drawerLinkActive, pressed && styles.pressed]}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: '700' }}>{label}</Text><Text style={{ color: COLORS.red, fontSize: 20 }}>›</Text></Pressable>)}
      </View></View>
    </Modal>
  </View>;
}

export function ProductImage({ source, label, style, resizeMode = 'contain' }: { source: ImageSourcePropType; label: string; style: ImageStyle; resizeMode?: 'contain' | 'cover' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <View accessible accessibilityRole="image" accessibilityLabel={`${label}, imagem indisponível`} style={[style, { backgroundColor: COLORS.redSoft, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }]}><Text style={{ color: COLORS.red, fontWeight: '900' }}>V</Text></View>;
  return <Image source={source} accessible accessibilityRole="image" accessibilityLabel={label} onError={() => setFailed(true)} resizeMode={resizeMode} style={style} />;
}

export function Avatar({ name, uri, size = 36 }: { name: string; uri?: string; size?: number }) {
  const [failed, setFailed] = useState(!uri);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  if (failed || !uri) return <View accessible accessibilityRole="image" accessibilityLabel={`Avatar de ${name}: ${initials}`} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS.redSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.red, fontSize: size * 0.36, fontWeight: '900' }}>{initials}</Text></View>;
  return <Image source={{ uri }} accessible accessibilityRole="image" accessibilityLabel={`Foto de perfil de ${name}`} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} />;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <View style={styles.brandFallback}><Text style={styles.brandFallbackText}>✿ verisure</Text></View>;
  return <Image source={require('../assets/verisure-logo.png')} accessible accessibilityRole="image" accessibilityLabel="Logotipo Verisure" onError={() => setFailed(true)} resizeMode="contain" resizeMethod="resize" style={{ width: compact ? 104 : 128, height: compact ? 46 : 58 }} />;
}

export function Card({ children, style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & { children: React.ReactNode; style?: StyleProp<ViewStyle> };

export function PrimaryButton({ children, style, ...props }: ButtonProps) {
  return <Pressable {...props} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, style]}><Text style={styles.primaryButtonText}>{children}</Text></Pressable>;
}

export function SecondaryButton({ children, style, ...props }: ButtonProps) {
  return <Pressable {...props} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, style]}><Text style={styles.secondaryButtonText}>{children}</Text></Pressable>;
}

export function Metric({ value, label }: { value: string; label: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export function Progress({ step, total }: { step: number; total: number }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, step / total)) * 100}%` }]} /></View>;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  screen: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#E7E9ED', alignItems: 'center', justifyContent: 'center' },
  drawerBackdrop: { flex: 1, backgroundColor: '#0008', flexDirection: 'row' },
  drawer: { width: '84%', maxWidth: 350, backgroundColor: COLORS.surface, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24, borderTopRightRadius: 24, borderBottomRightRadius: 24 },
  drawerLink: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#F0F1F3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderRadius: 10 },
  drawerLinkActive: { backgroundColor: '#FFF0F3' },
  eyebrow: { color: COLORS.red, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  headerTitle: { color: '#17191D', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  brandFallback: { minWidth: 128, minHeight: 58, justifyContent: 'center' },
  brandFallbackText: { color: COLORS.red, fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: COLORS.surface, borderRadius: 17, borderWidth: 1, borderColor: '#E9EBEF', padding: 18, shadowColor: '#121821', shadowOpacity: 0.035, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  sectionLabel: { color: '#70747C', fontSize: 10, fontWeight: '800', letterSpacing: 1.05, textTransform: 'uppercase' },
  primaryButton: { backgroundColor: COLORS.red, minHeight: 50, paddingHorizontal: 19, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: COLORS.surface, fontSize: 14, fontWeight: '800' },
  secondaryButton: { backgroundColor: COLORS.surface, minHeight: 48, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#DFE2E7', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COLORS.redDark, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  metric: { flex: 1, borderRightWidth: 1, borderRightColor: '#E9EBEF', paddingHorizontal: 12 },
  metricValue: { color: '#17191D', fontSize: 22, fontWeight: '800' },
  metricLabel: { color: '#737780', fontSize: 10, marginTop: 4 },
  progressTrack: { height: 5, backgroundColor: '#F1E6E9', borderRadius: 8, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 5, backgroundColor: COLORS.red, borderRadius: 8 },
});
