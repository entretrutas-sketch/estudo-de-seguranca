import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

export const COLORS = {
  red: '#ED0038', redDark: '#B9002B', redSoft: '#FFF0F3', ink: '#090909', text: '#171717',
  muted: '#6F6F74', surface: '#FFFFFF', canvas: '#FAF7F8', border: '#F0DDE1', success: '#147A4B',
} as const;

export type KitName = 'KIT PROTECTION' | 'BT4' | 'BT6' | 'BT8';
export type ProposalEquipmentLine = { name: string; quantity: number; description: string; kind: string; place: string; image: string };
type Kit = { name: KitName; description: string; extraSensors: number; accent: string };

export const KITS: Kit[] = [
  { name: 'KIT PROTECTION', description: 'Sistema base com unidade central, painel, videodetector interno, sensor de abertura, chaves, controle, botão de pânico, placas e MY VERISURE, conforme catálogo ativo.', extraSensors: 0, accent: '#ED0038' },
  { name: 'BT4', description: 'Composição KIT PROTECTION mais 3 sensores de abertura adicionais.', extraSensors: 3, accent: '#C90031' },
  { name: 'BT6', description: 'Composição KIT PROTECTION mais 5 sensores de abertura adicionais.', extraSensors: 5, accent: '#A90027' },
  { name: 'BT8', description: 'Composição KIT PROTECTION mais 7 sensores de abertura adicionais.', extraSensors: 7, accent: '#850020' },
];

export const EQUIPMENT = [
  { name: 'Unidade Central', quantity: 1, description: 'Central de comunicação em área protegida.', image: '07-unidade-central.webp', kind: 'Físico', place: 'Área protegida e discreta' },
  { name: 'Painel de Controle', quantity: 1, description: 'Operação local para usuários autorizados.', image: '06-painel-controle.webp', kind: 'Físico', place: 'Próximo à entrada, em área interna' },
  { name: 'Videodetector Interno', quantity: 1, description: 'Detecção com verificação visual em circulação interna.', image: '02-videodetector-interno.webp', kind: 'Físico', place: 'Sala, hall ou circulação' },
  { name: 'Sensor de abertura PreSense™', quantity: 1, description: 'Identifica abertura em um acesso compatível.', image: '05-sensor-abertura-presense.webp', kind: 'Físico', place: 'Porta ou janela avaliada' },
  { name: 'Chaves Inteligentes', quantity: 3, description: 'Chaves distribuídas a usuários autorizados.', image: '08-chaves-inteligentes.webp', kind: 'Físico', place: 'Com usuários autorizados' },
  { name: 'Controle remoto', quantity: 1, description: 'Controle de uso pelo responsável.', image: '09-controle-remoto.webp', kind: 'Físico', place: 'Com o responsável' },
  { name: 'Botão de pânico', quantity: 1, description: 'Acionamento discreto conforme serviço contratado.', image: '10-botao-panico.webp', kind: 'Físico', place: 'Ponto definido com o cliente' },
  { name: 'Placas de inibição', quantity: 2, description: 'Sinalização externa, sem detecção.', image: '04-placa-inibicao.webp', kind: 'Sinalização', place: 'Fachada, portão ou muro' },
  { name: 'MY VERISURE', quantity: 1, description: 'Aplicativo para até cinco usuários autorizados.', image: '11-my-verisure.webp', kind: 'Aplicativo', place: 'Celulares dos usuários autorizados' },
];

export type ClientDraft = { name: string; phone: string; locationName: string; street: string; addressNumber: string; complement: string; neighborhood: string; city: string; state: string; postalCode: string; propertyType: string };
export type SpecialistDraft = { name: string; email: string; phone: string; avatarUrl?: string };
export type EvaluationDraft = { accessCounts: { doors: number; windows: number; externalAccess: number }; garage: string; interiorAreas: string; notes: string; photoConsent: boolean; photoUris: string[] };
export type SavedStudy = {
  id: string;
  client: ClientDraft;
  kit: KitName | string;
  accessCounts: { doors: number; windows: number; externalAccess: number };
  finalEquipment: number;
  finalMonthly: number;
  equipmentOriginal?: number;
  monthlyOriginal?: number;
  issuedAt?: string;
  proposalVersion?: string;
  createdAt: string;
  synced?: boolean;
  specialist?: SpecialistDraft;
  evaluation?: EvaluationDraft;
  equipmentDiscount?: number;
  monthlyDiscount?: number;
  idempotencyKey?: string;
  customItems?: ProposalEquipmentLine[];
  propertyType?: string;
};
export type ChatMessage = { id: string; author: string; body: string; time: string; mine?: boolean; avatarUrl?: string };

type AppContextValue = {
  profile: { name: string; email: string; avatarUrl: string };
  studies: SavedStudy[];
  studiesStatus: 'loading' | 'ready' | 'offline';
  addStudy: (study: Omit<SavedStudy, 'id' | 'createdAt'>) => Promise<SavedStudy>;
  chatMessages: ChatMessage[];
  chatConnected: boolean;
  chatAuthorized: boolean;
  unreadCount: number;
  markChatRead: () => Promise<void>;
  sendChat: (body: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
function formatMessage(row: { id: string; author_name: string; author_avatar_url?: string; body: string; created_at: string; user_id: string }, currentUserId: string): ChatMessage {
  return {
    id: row.id,
    author: row.author_name,
    body: row.body,
    time: new Date(row.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    mine: row.user_id === currentUserId,
    avatarUrl: row.author_avatar_url,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [studies, setStudies] = useState<SavedStudy[]>([]);
  const [studiesStatus, setStudiesStatus] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatConnected, setChatConnected] = useState(false);
  const [chatAuthorized, setChatAuthorized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const readAt = useRef(new Date(0).toISOString());

  useEffect(() => {
    const client = supabase;
    if (!user || !client) { setProfileAvatarUrl(''); return; }
    let active = true;
    const metadataPhoto = String(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? '');
    const loadProfilePhoto = async () => {
      const { data: profileRow } = await client.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle();
      if (!active) return;
      const savedPath = String(profileRow?.avatar_url ?? '');
      if (savedPath) {
        const { data } = await client.storage.from('profile-avatars').createSignedUrl(savedPath, 60 * 60);
        if (active && data?.signedUrl) setProfileAvatarUrl(data.signedUrl);
      } else if (metadataPhoto) setProfileAvatarUrl(metadataPhoto);

      // Microsoft Graph returns the official account photo only when Microsoft OAuth
      // granted the delegated User.Read scope. Store it privately for later sessions.
      const providerToken = session?.provider_token;
      if (!providerToken) return;
      try {
        const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', { headers: { Authorization: `Bearer ${providerToken}` } });
        if (!response.ok) return;
        const image = await response.arrayBuffer();
        const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
        const path = `${user.id}/avatar`;
        const { error: uploadError } = await client.storage.from('profile-avatars').upload(path, image, { contentType, upsert: true });
        if (uploadError) return;
        const { error: profileError } = await client.from('profiles').upsert({ id: user.id, display_name: String(user.user_metadata?.name ?? user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Especialista'), avatar_url: path });
        if (profileError) return;
        const { data: signed } = await client.storage.from('profile-avatars').createSignedUrl(path, 60 * 60);
        if (active && signed?.signedUrl) setProfileAvatarUrl(signed.signedUrl);
      } catch { /* The profile still works with its OAuth metadata or initials. */ }
    };
    void loadProfilePhoto();
    return () => { active = false; };
  }, [user?.id, session?.provider_token]);

  useEffect(() => {
    if (!user) {
      setStudies([]);
      setStudiesStatus('offline');
      setChatMessages([]);
      setChatConnected(false);
      setChatAuthorized(false);
      setUnreadCount(0);
      return;
    }

    let active = true;
    setStudiesStatus('loading');
    if (!supabase) { setStudiesStatus('offline'); return () => { active = false; }; }

    void supabase.from('team_chat_members').select('enabled').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (active) setChatAuthorized(data?.enabled === true);
    });

    void (async () => {
      const { data } = await supabase.from('team_chat_reads').select('last_read_at').eq('user_id', user.id).maybeSingle();
      if (!active) return;
      if (!data) {
        const initialReadAt = new Date().toISOString();
        readAt.current = initialReadAt;
        await supabase.from('team_chat_reads').upsert({ user_id: user.id, last_read_at: initialReadAt });
      } else readAt.current = data.last_read_at;
    })().catch(() => undefined);

    void Promise.all([
      supabase.from('studies').select('id, data, created_at').order('created_at', { ascending: false }),
      supabase.from('team_chat_messages').select('id, user_id, author_name, author_avatar_url, body, created_at').order('created_at', { ascending: true }).limit(200),
    ]).then(async ([studyResult, chatResult]) => {
      if (!active) return;
      setStudiesStatus(studyResult.error ? 'offline' : 'ready');
      if (!studyResult.error && studyResult.data) {
        const remoteStudies = studyResult.data.map((row) => ({ ...(row.data as Omit<SavedStudy, 'id' | 'createdAt'>), id: row.id, createdAt: row.created_at, synced: true }));
        setStudies(remoteStudies);
      }
      if (!chatResult.error && chatResult.data) {
        const remoteMessages = chatResult.data.map((row) => formatMessage(row, user.id));
        const messages = remoteMessages;
        setChatMessages(messages);
        setUnreadCount(remoteMessages.filter((message, index) => !message.mine && new Date(chatResult.data[index].created_at) > new Date(readAt.current)).length);
      }
    }).catch((error: unknown) => { setStudiesStatus('offline'); console.warn('Falha ao sincronizar os dados:', error); });

    const channel = supabase.channel(`team-chat-${user.id}`).on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'team_chat_messages' },
        (payload) => {
        if (!active) return;
        const message = formatMessage(payload.new as { id: string; user_id: string; author_name: string; author_avatar_url?: string; body: string; created_at: string }, user.id);
        if (!message.mine && new Date(payload.new.created_at) > new Date(readAt.current)) setUnreadCount((count) => count + 1);
        setChatMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          const next = [...current, message];
          return next;
        });
      },
    ).subscribe((status) => setChatConnected(status === 'SUBSCRIBED'));

    return () => {
      active = false;
      setChatConnected(false);
      void supabase?.removeChannel(channel);
    };
  }, [user?.id]);

  const addStudy = useCallback(async (study: Omit<SavedStudy, 'id' | 'createdAt'>) => {
    if (!user) throw new Error('Entre na sua conta para salvar um estudo.');
    const id = study.idempotencyKey ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let createdAt = new Date().toISOString();
    let persistedStudy = study;
    let synced = false;
    let finalEquipment = study.finalEquipment;
    let finalMonthly = study.finalMonthly;
    let equipmentOriginal = study.equipmentOriginal;
    let monthlyOriginal = study.monthlyOriginal;
    if (supabase) {
      const uploadedPaths: string[] = [];
      if (study.evaluation?.photoUris.length) {
        if (!study.evaluation.photoConsent) throw new Error('O consentimento do cliente é obrigatório para anexar fotos.');
        const paths: string[] = [];
        try {
          for (const [index, uri] of study.evaluation.photoUris.slice(0, 5).entries()) {
            const response = await fetch(uri);
            const blob = await response.blob();
            if (!response.ok || blob.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) throw new Error('Foto inválida: use JPEG, PNG ou WebP de até 10 MB.');
            const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
            const path = `${user.id}/${id}/${index}.${extension}`;
            const { error: uploadError } = await supabase.storage.from('study-photos').upload(path, blob, { contentType: blob.type, upsert: true });
            if (uploadError) throw uploadError;
            paths.push(path); uploadedPaths.push(path);
          }
        } catch (uploadError) {
          if (uploadedPaths.length) await supabase.storage.from('study-photos').remove(uploadedPaths);
          throw uploadError;
        }
        persistedStudy = { ...study, evaluation: { ...study.evaluation, photoUris: paths } };
      }
      const { data, error } = await supabase.rpc('save_study', {
        p_id: id, p_kit_name: study.kit,
        p_equipment_discount: study.equipmentDiscount ?? 0,
        p_monthly_discount: study.monthlyDiscount ?? 0,
        p_study_data: persistedStudy,
      });
      if (error) {
        if (uploadedPaths.length) await supabase.storage.from('study-photos').remove(uploadedPaths);
        throw error;
      }
      const result = data as { finalEquipment: number; finalMonthly: number; equipmentOriginal?: number; monthlyOriginal?: number; createdAt?: string };
      finalEquipment = result.finalEquipment;
      finalMonthly = result.finalMonthly;
      equipmentOriginal = result.equipmentOriginal;
      monthlyOriginal = result.monthlyOriginal;
      createdAt = result.createdAt ?? createdAt;
      synced = true;
    }
    const item: SavedStudy = { ...persistedStudy, finalEquipment, finalMonthly, equipmentOriginal, monthlyOriginal, id, createdAt, synced };
    const next = [item, ...studies.filter((existing) => existing.id !== item.id)];
    setStudies(next);
    return item;
  }, [user, studies]);

  const sendChat = useCallback(async (body: string) => {
    if (!user) throw new Error('Entre na sua conta para enviar mensagens.');
    if (!chatAuthorized) throw new Error('Seu acesso ao chat interno ainda não foi liberado pela gestão.');
    const cleanBody = body.trim();
    if (!cleanBody) return;
    const authorName = String(user.user_metadata?.name ?? user.user_metadata?.user_name ?? user.email ?? 'Especialista');

    if (!supabase) throw new Error('Chat indisponível: configure o projeto Supabase para enviar mensagens.');
    const { data, error } = await supabase.from('team_chat_messages').insert({ user_id: user.id, author_name: authorName, author_avatar_url: profileAvatarUrl || String(user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? ''), body: cleanBody.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 4000) }).select('id, user_id, author_name, author_avatar_url, body, created_at').single();
    if (error) throw error;
    const message = formatMessage(data, user.id);
    const next = [...chatMessages, message];
    setChatMessages(next);
  }, [user, chatMessages, chatAuthorized, profileAvatarUrl]);

  const markChatRead = useCallback(async () => {
    if (!user || !supabase) { setUnreadCount(0); return; }
    const timestamp = new Date().toISOString();
    readAt.current = timestamp;
    setUnreadCount(0);
    const { error } = await supabase.from('team_chat_reads').upsert({ user_id: user.id, last_read_at: timestamp });
    if (error) throw error;
  }, [user]);

  const value = useMemo(() => ({
    profile: {
      name: String(user?.user_metadata?.name ?? user?.user_metadata?.user_name ?? user?.email?.split('@')[0] ?? 'Especialista'),
      email: user?.email ?? '',
      avatarUrl: profileAvatarUrl || String(user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture ?? ''),
    },
    studies,
    studiesStatus,
    addStudy,
    chatMessages,
    chatConnected,
    chatAuthorized,
    unreadCount,
    markChatRead,
    sendChat,
  }), [studies, studiesStatus, chatMessages, chatConnected, chatAuthorized, unreadCount, user, profileAvatarUrl, addStudy, sendChat, markChatRead]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

export function getKit(name: KitName) {
  return KITS.find((kit) => kit.name === name) ?? KITS[0];
}

export function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
