import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type AccessStatus = 'pending' | 'approved' | 'rejected' | 'loading';
type AuthContextValue = {
  user: User | null; session: Session | null; loading: boolean; configured: boolean;
  accessStatus: AccessStatus; isMaster: boolean;
  register: (name: string, employeeNumber: string, email: string, password: string) => Promise<void>;
  signInWithEmployee: (employeeNumber: string, password: string) => Promise<'pending' | 'rejected' | 'invalid' | 'signed-in'>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('loading');
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const isMaster = ['master_admin', 'admin'].includes(String(session?.user.app_metadata?.role ?? ''));

  useEffect(() => {
    let active = true;
    const client = supabase;
    if (!client) { setLoading(false); setAccessStatus('pending'); return; }
    const loadStatus = async (next: Session | null) => {
      if (!next) { if (active) { setAccessStatus('pending'); setSession(null); setLoading(false); } return; }
      setSession(next);
      const role = String(next.user.app_metadata?.role ?? '');
      if (['master_admin', 'admin', 'commercial_admin'].includes(role)) {
        if (active) { setAccessStatus('approved'); setLoading(false); }
        return;
      }
      const { data, error } = await client.from('profiles').select('access_status').eq('id', next.user.id).maybeSingle();
      if (!active) return;
      const status = error ? 'pending' : (data?.access_status ?? 'pending');
      if (status !== 'approved') {
        setSession(null); setAccessStatus(status === 'rejected' ? 'rejected' : 'pending');
        await client.auth.signOut();
      } else setAccessStatus('approved');
      setLoading(false);
    };
    void client.auth.getSession().then(({ data }) => loadStatus(data.session));
    const { data: listener } = client.auth.onAuthStateChange((_event, next) => { void loadStatus(next); });
    const appStateListener = Platform.OS === 'web' ? undefined : AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh();
    });
    return () => { active = false; listener.subscription.unsubscribe(); appStateListener?.remove(); };
  }, []);

  const register = async (name: string, employeeNumber: string, email: string, password: string) => {
    if (!supabase) throw new Error('Backend indisponível. Configure o Supabase para solicitar acesso.');
    const cleanName = name.trim(); const cleanNumber = employeeNumber.trim().toUpperCase(); const cleanEmail = email.trim().toLowerCase();
    if (cleanName.length < 3) throw new Error('Informe seu nome completo.');
    if (!/^[A-Z0-9.-]{3,30}$/.test(cleanNumber)) throw new Error('Confira sua matrícula.');
    if (!/^[^\s@]+@verisure\.com\.br$/.test(cleanEmail)) throw new Error('Use seu e-mail corporativo @verisure.com.br.');
    if (password.length < 10) throw new Error('Crie uma senha com pelo menos 10 caracteres.');
    const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { full_name: cleanName, employee_number: cleanNumber } } });
    if (error) throw error;
    if (data.session) await supabase.auth.signOut();
  };

  const signInWithEmployee = async (employeeNumber: string, password: string) => {
    if (!supabase) throw new Error('Backend indisponível. Configure o Supabase para entrar.');
    const { data, error } = await supabase.functions.invoke('employee-login', { body: { employeeNumber: employeeNumber.trim().toUpperCase(), password } });
    if (error) throw new Error('Não foi possível validar o acesso. Verifique a conexão e tente novamente.');
    const state = data?.state;
    if (state === 'pending' || state === 'rejected' || state === 'invalid') return state;
    if (!data?.access_token || !data?.refresh_token) throw new Error('Resposta de autenticação inválida.');
    const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
    if (sessionError) throw sessionError;
    return 'signed-in';
  };

  const signOut = async () => { if (supabase) await supabase.auth.signOut(); setSession(null); setAccessStatus('pending'); };
  const value = useMemo(() => ({ user: session?.user ?? null, session, loading, configured: isSupabaseConfigured, accessStatus, isMaster, register, signInWithEmployee, signOut }), [session, loading, accessStatus, isMaster]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
