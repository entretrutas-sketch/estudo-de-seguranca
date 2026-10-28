import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Avatar, Card, Header, Screen, SectionLabel } from '@/components/mobile-ui';
import { COLORS, useApp } from '@/lib/app-context';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function ChatScreen() {
  const { chatMessages, chatConnected, chatAuthorized, sendChat, markChatRead } = useApp();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const previousCount = useRef(chatMessages.length);
  useEffect(() => { void AsyncStorage.getItem('@verisure/mobile/notification-preferences').then((value) => { if (value) setHapticsEnabled((JSON.parse(value) as { haptics?: boolean }).haptics !== false); }).catch(() => undefined); }, []);
  useFocusEffect(useCallback(() => { void markChatRead().catch(() => undefined); }, [markChatRead]));
  useEffect(() => {
    if (hapticsEnabled && chatMessages.length > previousCount.current && chatMessages[chatMessages.length - 1]?.mine === false) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    previousCount.current = chatMessages.length;
  }, [chatMessages, hapticsEnabled]);
  const submit = async () => {
    const value = draft.trim(); if (!value) return;
    setError('');
    try { await sendChat(value); setDraft(''); if (hapticsEnabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Verifique a conexão e tente novamente.'); }
  };
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="Chat da equipe" right={<Text style={{ color: chatConnected ? COLORS.success : COLORS.muted, fontSize: 10, fontWeight: '900' }}>{!isSupabaseConfigured ? '○ NÃO CONFIGURADO' : !chatAuthorized ? '○ ACESSO PENDENTE' : chatConnected ? '● AO VIVO' : '○ OFFLINE'}</Text>} />
    <View style={{ flex: 1, paddingHorizontal: 20 }}><SectionLabel>Conversa interna</SectionLabel><Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: '900', marginTop: 8 }}>Canal geral da equipe</Text>
      {!isSupabaseConfigured && <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '800' }}>Chat indisponível neste ambiente</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>Configure projeto Supabase, autenticação e política de acesso antes de enviar ou receber mensagens.</Text></Card>}
      {isSupabaseConfigured && !chatAuthorized && <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '800' }}>Acesso pendente da gestão</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>Somente membros autorizados podem ler e enviar mensagens. A gestão deve habilitar seu usuário no cadastro de membros do Supabase.</Text></Card>}
      <FlatList data={chatMessages} keyExtractor={(item) => item.id} style={{ flex: 1, marginTop: 16 }} contentContainerStyle={{ flexGrow: 1, gap: 10, paddingBottom: 12 }} ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Nenhuma mensagem ainda</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>As conversas aparecem quando um membro enviar a primeira mensagem.</Text></View>} renderItem={({ item }) => <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '92%', flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}><Avatar name={item.author} uri={item.avatarUrl} size={30}/><View style={{ maxWidth: '88%', backgroundColor: item.mine ? COLORS.red : COLORS.surface, borderRadius: 16, padding: 13, borderWidth: item.mine ? 0 : 1, borderColor: COLORS.border }}><Text style={{ color: item.mine ? '#FFD7E0' : COLORS.red, fontSize: 10, fontWeight: '900' }}>{item.author} · {item.time}</Text><Text style={{ color: item.mine ? COLORS.surface : COLORS.ink, fontSize: 13, lineHeight: 19, marginTop: 6 }}>{item.body}</Text></View></View>} />
      {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, marginBottom: 8 }}>{error}</Text>}
      {isSupabaseConfigured && chatAuthorized && <Card style={{ marginBottom: 12, padding: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}><TextInput value={draft} onChangeText={setDraft} placeholder="Escreva uma mensagem…" placeholderTextColor="#A9A1A4" multiline maxLength={4000} style={{ flex: 1, minHeight: 42, maxHeight: 90, color: COLORS.ink, fontSize: 13, paddingHorizontal: 8, paddingVertical: 8 }} /><Pressable accessibilityRole="button" accessibilityLabel="Enviar mensagem" disabled={!draft.trim()} onPress={() => void submit()} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 14, backgroundColor: draft.trim() ? COLORS.red : COLORS.muted, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.75 }]}><Text style={{ color: COLORS.surface, fontSize: 20 }}>↑</Text></Pressable></Card>}
    </View>
  </KeyboardAvoidingView></Screen>;
}
