import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Modal, Pressable, StyleSheet, Text, View, type ImageStyle, type ImageSourcePropType, type PressableProps, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { COLORS } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';

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
  const { isMaster } = useAuth();
  const menuDestinations = isMaster ? [...destinations, ['Autorizar acessos', '/access-requests'] as const] : destinations;
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu de navegação" onPress={() => setOpen(true)} style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}><View style={styles.menuGlyph}><View style={styles.menuGlyphLine}/><View style={styles.menuGlyphLine}/><View style={styles.menuGlyphLine}/></View></Pressable>
    <View style={styles.headerDivider} />
    <View style={{ flex: 1, marginLeft: 13 }}><Text style={styles.eyebrow}>- {eyebrow}</Text><Text style={styles.headerTitle}>{title}</Text></View>{right}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.drawerBackdrop}><Pressable accessibilityLabel="Fechar menu" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} /><View style={styles.drawer}>
        <BrandMark /><Text style={[styles.eyebrow, { marginTop: 26, marginBottom: 8 }]}>NAVEGAÇÃO</Text>
        {menuDestinations.map(([label, path]) => <Pressable key={path} accessibilityRole="button" accessibilityState={{ selected: pathname === path || pathname === `/(tabs)${path}` }} onPress={() => { setOpen(false); router.push(path as never); }} style={({ pressed }) => [styles.drawerLink, (pathname === path || pathname === `/(tabs)${path}`) && styles.drawerLinkActive, pressed && styles.pressed]}><Text style={{ color: COLORS.ink, fontSize: 14, fontWeight: '700' }}>{label}</Text><Text style={{ color: COLORS.red, fontSize: 20 }}>›</Text></Pressable>)}
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
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  screen: { flex: 1, backgroundColor: COLORS.canvas },
  header: { paddingHorizontal: 20, paddingTop: 9, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { width: 46, height: 46, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#182236', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  headerDivider: { width: 1, height: 48, backgroundColor: '#A8AFBD', marginLeft: 10 },
  menuGlyph: { width: 19, gap: 4 },
  menuGlyphLine: { height: 2.5, borderRadius: 2, backgroundColor: COLORS.red },
  drawerBackdrop: { flex: 1, backgroundColor: '#0008', flexDirection: 'row' },
  drawer: { width: '84%', maxWidth: 350, backgroundColor: COLORS.surface, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24, borderTopRightRadius: 28, borderBottomRightRadius: 28 },
  drawerLink: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: '#F0F1F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 15 },
  drawerLinkActive: { backgroundColor: COLORS.redSoft },
  eyebrow: { color: COLORS.redDark, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  headerTitle: { color: COLORS.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.7, marginTop: 3 },
  brandFallback: { minWidth: 128, minHeight: 58, justifyContent: 'center' },
  brandFallbackText: { color: COLORS.red, fontSize: 20, fontWeight: '900' },
  card: { backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: '#EAECF2', padding: 18, shadowColor: '#1A263A', shadowOpacity: 0.065, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  sectionLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1.05, textTransform: 'uppercase' },
  primaryButton: { backgroundColor: COLORS.red, minHeight: 54, paddingHorizontal: 21, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.redDark, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  primaryButtonText: { color: COLORS.surface, fontSize: 14, fontWeight: '900', letterSpacing: 0.1 },
  secondaryButton: { backgroundColor: COLORS.surface, minHeight: 52, paddingHorizontal: 17, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: COLORS.redDark, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  metric: { flex: 1, borderRightWidth: 1, borderRightColor: '#E9EBF1', paddingHorizontal: 12 },
  metricValue: { color: COLORS.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  metricLabel: { color: COLORS.muted, fontSize: 11, lineHeight: 15, marginTop: 5 },
  progressTrack: { height: 7, backgroundColor: '#F4E3E8', borderRadius: 8, overflow: 'hidden', marginTop: 12 },
  progressFill: { height: 7, backgroundColor: COLORS.red, borderRadius: 8 },
});
