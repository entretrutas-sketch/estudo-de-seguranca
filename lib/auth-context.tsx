import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { corporateEmailMessage, isCorporateEmail, normalizeCorporateEmail } from '@/lib/corporate-email';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  requestEmailCode: (email: string, fullName: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const handledAuthCodes = new Set<string>();

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
  if (data.session && !isCorporateEmail(data.session.user.email ?? '')) {
    await supabase.auth.signOut();
    throw new Error(corporateEmailMessage);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let mounted = true;
    client.auth.getSession().then(async ({ data, error }) => {
      if (error) console.warn('Não foi possível restaurar a sessão:', error.message);
      if (mounted) {
        if (data.session && !isCorporateEmail(data.session.user.email ?? '')) {
          await client.auth.signOut();
          setSession(null);
        } else setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession && !isCorporateEmail(nextSession.user.email ?? '')) {
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
    if (!isCorporateEmail(normalizedEmail)) throw new Error(corporateEmailMessage);
    if (!fullName.trim()) throw new Error('Informe seu nome completo.');
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail, options: { shouldCreateUser: true, data: { name: fullName.trim() } } });
    if (error) throw error;
  };

  const verifyEmailCode = async (email: string, code: string) => {
    if (!supabase) throw new Error('Configure as credenciais do Supabase para entrar.');
    const normalizedEmail = normalizeCorporateEmail(email);
    if (!isCorporateEmail(normalizedEmail)) throw new Error(corporateEmailMessage);
    const { data, error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code.trim(), type: 'email' });
    if (error) throw error;
    if (data.user && !isCorporateEmail(data.user.email ?? '')) {
      await supabase.auth.signOut();
      throw new Error(corporateEmailMessage);
    }
  };

  const signInWithMicrosoft = async () => {
    if (!supabase) throw new Error('Configure as credenciais do Supabase para entrar.');
    const current = await supabase.auth.getSession();
    if (current.data.session && !isCorporateEmail(current.data.session.user.email ?? '')) {
      await supabase.auth.signOut();
      throw new Error(corporateEmailMessage);
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

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(() => ({
    user: session?.user ?? null,
    session,
    loading,
    configured: isSupabaseConfigured,
    requestEmailCode,
    verifyEmailCode,
    signInWithMicrosoft,
    signOut,
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
