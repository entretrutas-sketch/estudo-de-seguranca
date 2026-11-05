import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Avatar, Card, Header, PrimaryButton, Screen, SectionLabel, SecondaryButton } from '@/components/mobile-ui';
import { COLORS, type ChatMessage, useApp } from '@/lib/app-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { deleteSecureDraft, readSecureDraft, writeSecureDraft } from '@/lib/secure-draft';
import type { RealtimeChannel } from '@supabase/supabase-js';

type DirectMessage = { id: string; user_id: string; author_name: string; author_avatar_url?: string; body: string; created_at: string; edited_at?: string | null; deleted_at?: string | null; attachment_path?: string | null; attachment_mime?: string | null; attachment_size?: number | null; attachment_url?: string; read_at?: string | null };
type Conversation = { conversation_id: string; specialist_id: string; display_name: string; avatar_path: string; avatar_url?: string; last_message: string; last_message_at: string | null; unread_count: number; muted: boolean };
type TeamGroup = { conversation_id: string; title: string; last_message: string; last_message_at: string | null; unread_count: number; muted: boolean };
type GroupCandidate = { user_id: string; display_name: string; region: string; team_name: string };
const DRAFT_PREFIX = '@verisure/chat-draft/';
const messageTime = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const paramsString = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function ChatScreen() {
  const { specialistId: rawSpecialistId, specialistName: rawSpecialistName, conversationId: rawConversationId } = useLocalSearchParams<{ specialistId?: string | string[]; specialistName?: string | string[]; conversationId?: string | string[] }>();
  const specialistId = paramsString(rawSpecialistId);
  const specialistName = paramsString(rawSpecialistName) || 'Especialista';
  const routeConversationId = paramsString(rawConversationId);
  const { user } = useAuth();
  const { profile, chatMessages, chatConnected, chatAuthorized, sendChat, markChatRead, refreshDirectUnreadCount } = useApp();
  const [conversationId, setConversationId] = useState(routeConversationId || '');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupCandidates, setGroupCandidates] = useState<GroupCandidate[]>([]);
  const [selectedGroupPeople, setSelectedGroupPeople] = useState<string[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState('');
  const [draft, setDraft] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [muted, setMuted] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [olderLoading, setOlderLoading] = useState(false);
  const [now, setNow] = useState(0);
  const previousCount = useRef(chatMessages.length);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startInFlight = useRef(false);
  const directChannel = useRef<RealtimeChannel | null>(null);
  const draftKey = `${DRAFT_PREFIX}${user?.id ?? 'anonymous'}:${routeConversationId || specialistId || 'team'}`;

  const loadInbox = useCallback(async () => {
    if (!supabase) return;
    setInboxLoading(true); setInboxError('');
    const [{ data, error: problem }, { data: groupData, error: groupProblem }] = await Promise.all([
      supabase.rpc('list_direct_conversations'), supabase.rpc('list_team_groups'),
    ]);
    if (problem || groupProblem) { setInboxError('Não foi possível carregar as conversas. Confira a atualização do banco.'); setInboxLoading(false); return; }
    const withAvatars = await Promise.all(((data ?? []) as Conversation[]).map(async (conversation) => {
      if (!conversation.avatar_path) return conversation;
      const { data: signed } = await supabase!.storage.from('profile-avatars').createSignedUrl(conversation.avatar_path, 15 * 60);
      return { ...conversation, avatar_url: signed?.signedUrl };
    }));
    setConversations(withAvatars); setGroups((groupData ?? []) as TeamGroup[]); setInboxLoading(false);
  }, []);

  useEffect(() => { setConversationId(routeConversationId || ''); }, [routeConversationId]);
  useEffect(() => {
    let active = true;
    void readSecureDraft(draftKey).then((value) => { if (active && value) setDraft(value); }).catch(() => undefined).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => { if (!draftReady) return; if (draft) void writeSecureDraft(draftKey, draft).catch(() => undefined); else void deleteSecureDraft(draftKey).catch(() => undefined); }, [draft, draftKey, draftReady]);

  useEffect(() => {
    if (!specialistId || routeConversationId || startInFlight.current || !supabase) return;
    startInFlight.current = true;
    let active = true;
    setLoading(true); setError('');
    void (async () => {
      try {
        const { data, error: problem } = await supabase!.rpc('start_direct_conversation', { p_other_user_id: specialistId });
        if (!active) return;
        if (problem || typeof data !== 'string') { setError(problem?.message || 'Não foi possível iniciar esta conversa.'); return; }
        setConversationId(data);
        router.replace({ pathname: '/chat', params: { conversationId: data, specialistName } });
      } catch { if (active) setError('Não foi possível iniciar esta conversa. Confira a conexão e a autorização de colaboração.'); }
      finally { startInFlight.current = false; if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [specialistId, routeConversationId, specialistName]);

  const loadDirectMessages = useCallback(async (before?: string) => {
    if (!supabase || !conversationId || !user) return;
    setLoading(true); setError('');
    const query = supabase.from('team_chat_messages').select('id,user_id,author_name,author_avatar_url,body,created_at,edited_at,deleted_at,attachment_path,attachment_mime,attachment_size').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(50);
    const { data, error: problem } = before ? await query.lt('created_at', before) : await query;
    if (problem) { setError('Não foi possível sincronizar as mensagens. O rascunho continua guardado neste aparelho.'); setLoading(false); return; }
    const page = (data ?? []).reverse() as DirectMessage[];
    const withFiles = await Promise.all(page.map(async (message) => {
      if (!message.attachment_path) return message;
      const { data: signed } = await supabase!.storage.from('team-chat-attachments').createSignedUrl(message.attachment_path, 15 * 60);
      return { ...message, attachment_url: signed?.signedUrl };
    }));
    const ids = withFiles.filter((item) => item.user_id === user.id).map((item) => item.id);
    if (ids.length) {
      const { data: receipts } = await supabase.from('team_chat_message_receipts').select('message_id,read_at').in('message_id', ids);
      const receiptById = new Map((receipts ?? []).map((receipt) => [receipt.message_id, receipt.read_at]));
      withFiles.forEach((message) => { if (message.user_id === user.id) message.read_at = receiptById.get(message.id) ?? null; });
    }
    if (before) setMessages((current) => [...withFiles.filter((message) => !current.some((old) => old.id === message.id)), ...current]);
    else setMessages(withFiles);
    const incoming = withFiles.filter((message) => message.user_id !== user.id);
    if (incoming.length) {
      const now = new Date().toISOString();
      await supabase.from('team_chat_message_receipts').upsert(incoming.map((message) => ({ message_id: message.id, user_id: user.id, delivered_at: now, read_at: now })), { onConflict: 'message_id,user_id' });
      await refreshDirectUnreadCount();
    }
    setLoading(false);
  }, [conversationId, user, refreshDirectUnreadCount]);

  useEffect(() => {
    if (!conversationId || !user || !supabase) return;
    let active = true;
    void loadDirectMessages();
    void supabase.from('team_conversation_participants').select('muted').eq('conversation_id', conversationId).eq('user_id', user.id).maybeSingle().then(({ data }) => { if (active) setMuted(data?.muted === true); });
    const channel = supabase.channel(`direct-${conversationId}`, { config: { private: true, presence: { key: user.id } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_chat_messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
        if (!active) return;
        const row = payload.new as DirectMessage;
        if (row.attachment_path) {
          const { data } = await supabase!.storage.from('team-chat-attachments').createSignedUrl(row.attachment_path, 15 * 60);
          row.attachment_url = data?.signedUrl;
        }
        setMessages((current) => current.some((message) => message.id === row.id) ? current : [...current, row].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        if (row.user_id !== user.id) {
          const timestamp = new Date().toISOString();
          await supabase!.from('team_chat_message_receipts').upsert({ message_id: row.id, user_id: user.id, delivered_at: timestamp, read_at: timestamp }, { onConflict: 'message_id,user_id' });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_chat_message_receipts' }, (payload) => {
        if (!active) return;
        const receipt = payload.new as { message_id?: string; read_at?: string | null };
        if (receipt.message_id && receipt.read_at) setMessages((current) => current.map((message) => message.id === receipt.message_id ? { ...message, read_at: receipt.read_at } : message));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOtherOnline(Object.keys(state).some((key) => key !== user.id));
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if ((payload as { userId?: string }).userId === user.id) return;
        setTyping((payload as { active?: boolean }).active === true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if ((payload as { active?: boolean }).active) typingTimer.current = setTimeout(() => setTyping(false), 3500);
      })
      .subscribe((status) => {
        directChannel.current = status === 'SUBSCRIBED' ? channel : null;
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void channel.track({ online_at: new Date().toISOString() });
      });
    return () => { active = false; directChannel.current = null; setConnected(false); if (typingTimer.current) clearTimeout(typingTimer.current); void supabase?.removeChannel(channel); };
  }, [conversationId, user, loadDirectMessages]);

  const sendDirect = async (attachment?: { blob: Blob; name: string; mime: string }) => {
    if (!supabase || !user || !conversationId || sending || (!draft.trim() && !attachment)) return;
    setSending(true); setError('');
    let attachmentPath: string | null = null;
    try {
      if (attachment) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(attachment.mime) || attachment.blob.size > 10 * 1024 * 1024) throw new Error('Anexe uma imagem ou PDF de até 10 MB.');
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        attachmentPath = `${conversationId}/${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('team-chat-attachments').upload(attachmentPath, attachment.blob, { contentType: attachment.mime, upsert: false });
        if (uploadError) throw uploadError;
      }
      if (editingId) {
        const { error: updateError } = await supabase.from('team_chat_messages').update({ body: draft.trim(), edited_at: new Date().toISOString() }).eq('id', editingId);
        if (updateError) throw updateError;
        setMessages((current) => current.map((message) => message.id === editingId ? { ...message, body: draft.trim(), edited_at: new Date().toISOString() } : message));
        setEditingId('');
      } else {
        const body = draft.trim() || attachment?.name || 'Arquivo compartilhado';
        const { data, error: insertError } = await supabase.from('team_chat_messages').insert({ conversation_id: conversationId, user_id: user.id, author_name: profile.name, author_avatar_url: profile.avatarUrl, body, attachment_path: attachmentPath, attachment_mime: attachment?.mime ?? null, attachment_size: attachment?.blob.size ?? null }).select('id,user_id,author_name,author_avatar_url,body,created_at,attachment_path,attachment_mime,attachment_size').single();
        if (insertError) throw insertError;
        const row = data as DirectMessage;
        if (row.attachment_path) { const { data: signed } = await supabase.storage.from('team-chat-attachments').createSignedUrl(row.attachment_path, 15 * 60); row.attachment_url = signed?.signedUrl; }
        setMessages((current) => current.some((message) => message.id === row.id) ? current : [...current, row].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        setDraft('');
      }
      await deleteSecureDraft(draftKey);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Envio falhou. Sua mensagem continua salva no rascunho.');
      if (attachmentPath) await supabase.storage.from('team-chat-attachments').remove([attachmentPath]).catch(() => undefined);
    } finally { setSending(false); }
  };

  const pickAttachment = async () => {
    if (!conversationId || !supabase) { setError('Aguarde a conexão com a conversa antes de anexar um arquivo.'); return; }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], multiple: false, copyToCacheDirectory: true });
      if (result.canceled || !result.assets[0]) return;
      const file = result.assets[0];
      if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimeType ?? '') || (file.size ?? 0) > 10 * 1024 * 1024) throw new Error('Escolha uma imagem JPEG, PNG ou WebP ou um PDF de até 10 MB.');
      const response = await fetch(file.uri);
      if (!response.ok) throw new Error('Não foi possível ler o arquivo selecionado.');
      await sendDirect({ blob: await response.blob(), name: file.name, mime: file.mimeType ?? 'application/octet-stream' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível anexar o arquivo.'); }
  };

  const startEdit = (message: DirectMessage) => { setEditingId(message.id); setDraft(message.body); };
  const removeMessage = async (message: DirectMessage) => {
    if (!supabase) return;
    const now = new Date().toISOString();
    const { error: problem } = await supabase.from('team_chat_messages').update({ body: 'Mensagem removida', deleted_at: now, edited_at: now }).eq('id', message.id);
    if (problem) setError('Não foi possível remover a mensagem.');
    else setMessages((current) => current.map((item) => item.id === message.id ? { ...item, body: 'Mensagem removida', deleted_at: now, edited_at: now } : item));
  };
  const toggleMute = async () => {
    if (!supabase || !user || !conversationId) return;
    const next = !muted;
    const { error: problem } = await supabase.from('team_conversation_participants').update({ muted: next }).eq('conversation_id', conversationId).eq('user_id', user.id);
    if (problem) setError('Não foi possível atualizar as notificações desta conversa.'); else setMuted(next);
  };
  const sendTyping = (value: string) => {
    setDraft(value);
    if (directChannel.current) void directChannel.current.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, active: Boolean(value.trim()) } }).catch(() => undefined);
  };
  const visibleMessages = useMemo(() => messages.filter((message) => !search.trim() || message.body.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))), [messages, search]);
  const isDirect = Boolean(specialistId || routeConversationId || conversationId);

  useFocusEffect(useCallback(() => { if (!specialistId) void markChatRead().catch(() => undefined); }, [markChatRead, specialistId]));
  useFocusEffect(useCallback(() => { if (!isDirect) { void loadInbox(); void refreshDirectUnreadCount(); } }, [isDirect, loadInbox, refreshDirectUnreadCount]));
  useEffect(() => {
    if (!showCreateGroup || !supabase) return;
    let active = true;
    void supabase.from('specialist_directory').select('user_id,display_name,region,team_name').order('display_name').then(({ data }) => {
      if (active) setGroupCandidates(((data ?? []) as GroupCandidate[]).filter((person) => person.user_id !== user?.id));
    });
    return () => { active = false; };
  }, [showCreateGroup, user?.id]);
  useEffect(() => { setNow(Date.now()); const interval = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(interval); }, []);
  useEffect(() => { if (chatMessages.length > previousCount.current && chatMessages.at(-1)?.mine === false) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); previousCount.current = chatMessages.length; }, [chatMessages]);
  const submitGroup = async () => {
    if (!draft.trim()) return;
    setError('');
    try { await sendChat(draft.trim()); setDraft(''); await deleteSecureDraft(draftKey); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Envio falhou. Seu rascunho continua salvo neste aparelho.'); }
  };
  const createGroup = async () => {
    if (!supabase || groupTitle.trim().length < 2 || selectedGroupPeople.length < 2) return;
    setGroupSaving(true); setError('');
    const { data, error: problem } = await supabase.rpc('create_team_group', { p_title: groupTitle.trim(), p_member_ids: selectedGroupPeople });
    setGroupSaving(false);
    if (problem || typeof data !== 'string') { setError(problem?.message || 'Não foi possível criar o grupo.'); return; }
    const title = groupTitle.trim();
    setShowCreateGroup(false); setGroupTitle(''); setSelectedGroupPeople([]);
    router.push({ pathname: '/chat', params: { conversationId: data, specialistName: title } });
  };

  if (isDirect) return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title={specialistName} right={<Pressable accessibilityRole="switch" accessibilityLabel="Silenciar conversa" accessibilityState={{ checked: muted }} onPress={() => void toggleMute()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: muted ? COLORS.red : COLORS.muted, fontSize: 11, fontWeight: '900' }}>{muted ? 'SILENCIADA' : 'SILENCIAR'}</Text></Pressable>} />
    <View style={{ flex: 1, paddingHorizontal: 20 }}><SectionLabel>CONVERSA PRIVADA</SectionLabel><Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 5 }}>{connected ? otherOnline ? 'Participante online agora' : 'Conectado · última atividade indisponível' : 'Conectando e sincronizando…'}{typing ? ' · Digitando…' : ''}</Text>
      <TextInput accessibilityLabel="Buscar nesta conversa" value={search} onChangeText={setSearch} placeholder="Buscar nesta conversa" placeholderTextColor={COLORS.muted} style={{ minHeight: 44, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, marginTop: 10, backgroundColor: COLORS.surface, color: COLORS.ink }} />
      {loading && messages.length === 0 ? <ActivityIndicator color={COLORS.red} style={{ marginTop: 24 }} /> : null}
      {!!error && <Card style={{ marginTop: 10, padding: 12, backgroundColor: '#FFF3F4' }}><Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, lineHeight: 17 }}>{error}</Text></Card>}
      <FlatList data={visibleMessages} keyExtractor={(item) => item.id} style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ flexGrow: 1, gap: 10, paddingBottom: 12 }} ListHeaderComponent={messages.length >= 50 ? <Pressable accessibilityRole="button" disabled={olderLoading} onPress={() => { const oldest = messages[0]?.created_at; if (!oldest) return; setOlderLoading(true); void loadDirectMessages(oldest).finally(() => setOlderLoading(false)); }} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: COLORS.red, fontWeight: '800' }}>{olderLoading ? 'Carregando…' : 'Carregar mensagens anteriores'}</Text></Pressable> : null} ListEmptyComponent={!loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>{search ? 'Nenhuma mensagem encontrada' : 'Comece a conversa'}</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>As mensagens desta conversa ficam sincronizadas com o servidor.</Text></View> : null} renderItem={({ item }) => {
        const mine = item.user_id === user?.id;
        const editable = mine && !item.deleted_at && now - new Date(item.created_at).getTime() < 15 * 60 * 1000;
        return <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '94%', flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}>
          {!mine && <Avatar name={item.author_name} uri={item.author_avatar_url} size={30} />}
          <View style={{ maxWidth: '90%', backgroundColor: mine ? COLORS.ink : COLORS.surface, borderRadius: 16, padding: 12, borderWidth: mine ? 0 : 1, borderColor: COLORS.border }}>
            <Text style={{ color: mine ? '#CBD2DF' : COLORS.red, fontSize: 10, fontWeight: '900' }}>{mine ? 'Você' : item.author_name} · {messageTime(item.created_at)}{item.edited_at && !item.deleted_at ? ' · editada' : ''}</Text>
            {item.attachment_url && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(item.attachment_url!)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: mine ? '#FFFFFF' : COLORS.redDark, fontWeight: '800' }}>{item.attachment_mime === 'application/pdf' ? 'Abrir PDF' : 'Abrir imagem'} · {Math.ceil((item.attachment_size ?? 0) / 1024)} KB</Text></Pressable>}
            <Text style={{ color: item.deleted_at ? '#C5CAD3' : mine ? COLORS.surface : COLORS.ink, fontSize: 13, lineHeight: 19, marginTop: 5, fontStyle: item.deleted_at ? 'italic' : 'normal' }}>{item.body}</Text>
            {mine && <Text style={{ color: item.read_at ? '#93D8B6' : '#CBD2DF', fontSize: 10, textAlign: 'right', marginTop: 5 }}>{item.read_at ? 'Lida' : 'Enviada ao servidor'}</Text>}
            {editable && <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}><Pressable accessibilityRole="button" onPress={() => startEdit(item)} style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: mine ? '#FFD9E0' : COLORS.red, fontSize: 10, fontWeight: '800' }}>Editar</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void removeMessage(item)} style={{ minHeight: 32, justifyContent: 'center' }}><Text style={{ color: mine ? '#FFD9E0' : COLORS.red, fontSize: 10, fontWeight: '800' }}>Remover</Text></Pressable></View>}
          </View>
        </View>;
      }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Anexar imagem ou PDF" onPress={() => void pickAttachment()} style={{ minWidth: 44, minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.red, fontWeight: '900' }}>＋</Text></Pressable>
        <TextInput accessibilityLabel="Mensagem" value={draft} onChangeText={sendTyping} placeholder={editingId ? 'Editar mensagem…' : 'Escreva uma mensagem…'} placeholderTextColor={COLORS.muted} multiline maxLength={4000} style={{ flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.surface, color: COLORS.ink }} />
        <PrimaryButton disabled={!draft.trim() || sending} onPress={() => void sendDirect()} style={{ minWidth: 54, minHeight: 48, paddingHorizontal: 12 }}>{sending ? '…' : editingId ? 'Salvar' : 'Enviar'}</PrimaryButton>
      </View>
    </View>
  </KeyboardAvoidingView></Screen>;

  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Header title="Equipe" right={<Text style={{ color: chatConnected ? COLORS.success : COLORS.muted, fontSize: 10, fontWeight: '900' }}>{!chatAuthorized ? 'ACESSO PENDENTE' : chatConnected ? 'AO VIVO' : 'OFFLINE'}</Text>} />
    <View style={{ flex: 1, paddingHorizontal: 20 }}><SectionLabel>COLABORAÇÃO</SectionLabel><Text style={{ color: COLORS.ink, fontSize: 22, fontWeight: '900', marginTop: 8 }}>Canal geral da equipe</Text>
      <View style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 14 }}>Conversas individuais</Text>{inboxError ? <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 11, marginTop: 5 }}>{inboxError}</Text> : inboxLoading && conversations.length === 0 ? <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 5 }}>Carregando conversas…</Text> : conversations.length === 0 ? <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 5 }}>Inicie uma conversa pelo diretório de especialistas autorizados.</Text> : <View style={{ maxHeight: 116 }}><FlatList horizontal data={conversations} keyExtractor={(item) => item.conversation_id} contentContainerStyle={{ gap: 8, paddingVertical: 8, paddingRight: 12 }} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir conversa com ${item.display_name}${item.unread_count ? `, ${item.unread_count} não lidas` : ''}`} onPress={() => router.push({ pathname: '/chat', params: { conversationId: item.conversation_id, specialistName: item.display_name } })} style={{ width: 268, minHeight: 84, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 }}><Avatar name={item.display_name} uri={item.avatar_url} size={38} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 12, fontWeight: '900' }}>{item.display_name}</Text><Text numberOfLines={1} style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>{item.last_message || 'Conversa iniciada'}</Text></View>{item.unread_count > 0 && <Text style={{ color: COLORS.surface, backgroundColor: COLORS.red, fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 12 }}>{item.unread_count}</Text>}</Pressable>} /></View>}</View>
      {!chatAuthorized && <Card style={{ marginTop: 12 }}><Text style={{ color: COLORS.ink, fontWeight: '800' }}>Colaboração ainda não habilitada</Text><Text style={{ color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>A gestão precisa aprovar seu perfil e habilitar o chat.</Text></Card>}
      <FlatList data={chatMessages} keyExtractor={(item) => item.id} style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ flexGrow: 1, gap: 10, paddingBottom: 12 }} ListEmptyComponent={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: COLORS.ink, fontWeight: '900' }}>Canal sem mensagens</Text><Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>Quando a equipe iniciar uma conversa, as mensagens aparecerão aqui.</Text></View>} renderItem={({ item }: { item: ChatMessage }) => <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '92%', flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}><Avatar name={item.author} uri={item.avatarUrl} size={30} /><View style={{ maxWidth: '88%', backgroundColor: item.mine ? COLORS.ink : COLORS.surface, borderRadius: 16, padding: 12, borderWidth: item.mine ? 0 : 1, borderColor: COLORS.border }}><Text style={{ color: item.mine ? '#CBD2DF' : COLORS.red, fontSize: 10, fontWeight: '900' }}>{item.author} · {item.time}</Text><Text style={{ color: item.mine ? COLORS.surface : COLORS.ink, fontSize: 13, lineHeight: 19, marginTop: 5 }}>{item.body}</Text>{item.mine && <Text style={{ color: '#CBD2DF', fontSize: 10, textAlign: 'right', marginTop: 4 }}>Enviada ao servidor</Text>}</View></View>} />
      {!!error && <Text accessibilityRole="alert" style={{ color: COLORS.redDark, fontSize: 12, marginBottom: 8 }}>{error}</Text>}
      {chatAuthorized && <Card style={{ marginBottom: 12, padding: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}><TextInput accessibilityLabel="Mensagem para o canal" value={draft} onChangeText={setDraft} placeholder="Escreva para a equipe…" placeholderTextColor={COLORS.muted} multiline maxLength={4000} style={{ flex: 1, minHeight: 44, maxHeight: 100, color: COLORS.ink, fontSize: 13, paddingHorizontal: 8, paddingVertical: 8 }} /><PrimaryButton accessibilityLabel="Enviar mensagem" disabled={!draft.trim()} onPress={() => void submitGroup()} style={{ minWidth: 52, minHeight: 44, paddingHorizontal: 10 }}>Enviar</PrimaryButton></Card>}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: COLORS.ink, fontWeight: '900', fontSize: 14 }}>Grupos</Text>
        {groups.length === 0 ? <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 5 }}>Crie um grupo com especialistas autorizados.</Text> : <View style={{ maxHeight: 112 }}><FlatList horizontal data={groups} keyExtractor={(item) => item.conversation_id} contentContainerStyle={{ gap: 8, paddingVertical: 8 }} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/chat', params: { conversationId: item.conversation_id, specialistName: item.title } })} style={{ width: 240, minHeight: 72, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, padding: 10, justifyContent: 'center' }}><Text numberOfLines={1} style={{ color: COLORS.ink, fontSize: 12, fontWeight: '900' }}>{item.title}</Text><Text numberOfLines={1} style={{ color: COLORS.muted, fontSize: 10, marginTop: 4 }}>{item.last_message || 'Grupo criado'}</Text></Pressable>} /></View>}
        <SecondaryButton onPress={() => setShowCreateGroup((value) => !value)} style={{ marginTop: 4 }}>{showCreateGroup ? 'Fechar criação de grupo' : 'Criar grupo'}</SecondaryButton>
        {showCreateGroup && <Card style={{ marginTop: 8, padding: 12 }}>
          <TextInput accessibilityLabel="Nome do grupo" value={groupTitle} onChangeText={setGroupTitle} placeholder="Nome do grupo" placeholderTextColor={COLORS.muted} maxLength={80} style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, color: COLORS.ink }} />
          <Text style={{ color: COLORS.muted, fontSize: 11, marginVertical: 8 }}>Selecione pelo menos dois especialistas autorizados.</Text>
          {groupCandidates.map((person) => { const selected = selectedGroupPeople.includes(person.user_id); return <Pressable key={person.user_id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setSelectedGroupPeople((current) => selected ? current.filter((id) => id !== person.user_id) : [...current, person.user_id])} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border }}><Text style={{ color: selected ? COLORS.red : COLORS.muted, fontSize: 16 }}>{selected ? '☑' : '□'}</Text><Text style={{ color: COLORS.ink, fontWeight: '700', fontSize: 12 }}>{person.display_name}</Text><Text style={{ color: COLORS.muted, fontSize: 10 }}>{[person.region, person.team_name].filter(Boolean).join(' · ')}</Text></Pressable>; })}
          <PrimaryButton disabled={groupSaving || groupTitle.trim().length < 2 || selectedGroupPeople.length < 2} onPress={() => void createGroup()} style={{ marginTop: 10 }}>{groupSaving ? 'Criando…' : 'Criar grupo'}</PrimaryButton>
        </Card>}
      </View>
      <SecondaryButton onPress={() => router.push('/specialists' as never)} style={{ marginBottom: 12 }}>Encontrar especialista</SecondaryButton>
    </View>
  </KeyboardAvoidingView></Screen>;
}
