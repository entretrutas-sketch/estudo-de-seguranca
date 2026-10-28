import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { allowedEmailMessage, isAllowedEmail, normalizeCorporateEmail } from '@/lib/corporate-email';

type AuthContextValue = {
  user: User | null;
  localProfile: { name: string; email: string } | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  requestEmailCode: (email: string, fullName: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInLocally: (name: string, email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const handledAuthCodes = new Set<string>();
const LOCAL_PROFILE_KEY = 'estudo-seguranca:local-profile:v1';

async function handleAuthUrl(url: string) {
  if (!supabase) return;
  const parsed = ExpoLinking.parse(url);
  const code = parsed.queryParams?.code;
  if (typeof code !== 'string' || handledAuthCodes.has(code)) return;
  handledAuthCodes.add(code);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    handledAuthCodes.delete(code);
    throw error;
  }
  const { data } = await supabase.auth.getSession();
  if (data.session && !isAllowedEmail(data.session.user.email ?? '')) {
    await supabase.auth.signOut();
    throw new Error(allowedEmailMessage);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [localProfile, setLocalProfile] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(LOCAL_PROFILE_KEY).then((saved) => {
      if (!mounted || !saved) return;
      try {
        const profile = JSON.parse(saved) as { name?: unknown; email?: unknown };
        if (typeof profile.name === 'string' && profile.name.trim() && typeof profile.email === 'string' && isAllowedEmail(profile.email)) {
          setLocalProfile({ name: profile.name.trim(), email: normalizeCorporateEmail(profile.email) });
        }
      } catch { void AsyncStorage.removeItem(LOCAL_PROFILE_KEY); }
    }).catch(() => undefined).finally(() => { if (mounted && !isSupabaseConfigured) setLoading(false); });
    const client = supabase;
    if (!client) return () => { mounted = false; };

    client.auth.getSession().then(async ({ data, error }) => {
      if (error) console.warn('Não foi possível restaurar a sessão:', error.message);
      if (mounted) {
        if (data.session && !isAllowedEmail(data.session.user.email ?? '')) {
          await client.auth.signOut();
          setSession(null);
        } else setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession && !isAllowedEmail(nextSession.user.email ?? '')) {
        setSession(null);
        // Avoid calling Supabase auth methods inside its auth-state callback.
        setTimeout(() => { void client.auth.signOut(); }, 0);
        setLoading(false);
        return;
      }
      setSession(nextSession);
      setLoading(false);
    });

    const linkListener = Platform.OS === 'web' ? undefined : Linking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url).catch((error: unknown) => console.warn('Falha ao concluir o login:', error));
    });
    if (Platform.OS !== 'web') {
      void Linking.getInitialURL().then((url) => {
        if (url) return handleAuthUrl(url);
      }).catch((error: unknown) => console.warn('Falha ao processar o retorno do login:', error));
    }
    const appStateListener = Platform.OS === 'web' ? undefined : AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
    if (Platform.OS !== 'web' && AppState.currentState === 'active') void client.auth.startAutoRefresh();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      linkListener?.remove();
      appStateListener?.remove();
    };
  }, []);

  const requestEmailCode = async (email: string, fullName: string) => {
    if (!supabase) throw new Error('Configure as credenciais do Supabase para entrar.');
    const normalizedEmail = normalizeCorporateEmail(email);
    if (!isAllowedEmail(normalizedEmail)) throw new Error(allowedEmailMessage);
    if (!fullName.trim()) throw new Error('Informe seu nome completo.');
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true, data: { name: fullName.trim() } } });
    if (error) throw error;
  };

  const verifyEmailCode = async (email: string, code: string) => {
    if (!supabase) throw new Error('Configure as credenciais do Supabase para entrar.');
    const normalizedEmail = normalizeCorporateEmail(email);
    if (!isAllowedEmail(normalizedEmail)) throw new Error(allowedEmailMessage);
    const { data, error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code.trim(), type: 'email' });
    if (error) throw error;
    if (data.user && !isAllowedEmail(data.user.email ?? '')) {
      await supabase.auth.signOut();
      throw new Error(allowedEmailMessage);
    }
  };

  const signInWithMicrosoft = async () => {
    if (!supabase) throw new Error('Configure as credenciais do Supabase para entrar.');
    const current = await supabase.auth.getSession();
    if (current.data.session && !isAllowedEmail(current.data.session.user.email ?? '')) {
      await supabase.auth.signOut();
      throw new Error(allowedEmailMessage);
    }
    const redirectTo = ExpoLinking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo, scopes: 'email openid profile User.Read', skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw error;
    if (!data.url) throw new Error('A Microsoft não retornou o endereço de autenticação.');
    if (Platform.OS === 'web') return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) await handleAuthUrl(result.url);
  };

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('O login Google exige a conexão com o Supabase. Use o acesso local temporário enquanto ela não estiver configurada.');
    const redirectTo = ExpoLinking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, scopes: 'openid email profile', skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw new Error('Não foi possível iniciar o Google. Confirme se o provedor Google está habilitado no Supabase.');
    if (!data.url) throw new Error('O Google não retornou o endereço de autenticação.');
    if (Platform.OS === 'web') return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) await handleAuthUrl(result.url);
  };

  const signInLocally = async (name: string, email: string) => {
    const normalizedEmail = normalizeCorporateEmail(email);
    if (!name.trim()) throw new Error('Informe seu nome completo.');
    if (!isAllowedEmail(normalizedEmail)) throw new Error(allowedEmailMessage);
    const next = { name: name.trim(), email: normalizedEmail };
    await AsyncStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(next));
    setLocalProfile(next);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(LOCAL_PROFILE_KEY);
    setLocalProfile(null);
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  };

  const value = useMemo(() => ({
    user: session?.user ?? null,
    localProfile,
    session,
    loading,
    configured: isSupabaseConfigured,
    requestEmailCode,
    verifyEmailCode,
    signInWithMicrosoft,
    signInWithGoogle,
    signInLocally,
    signOut,
  }), [session, localProfile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
