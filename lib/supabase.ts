import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const isPlaceholder = (value: string | undefined) =>
  !value || /your-project-ref|your[_-]key|replace[_-]?me|placeholder/i.test(value);

function isValidSupabaseUrl(value: string | undefined) {
  if (!value || isPlaceholder(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.hostname === 'localhost') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidPublishableKey(value: string | undefined) {
  // Supabase supports the newer publishable keys and legacy anon JWT keys.
  return Boolean(value && !isPlaceholder(value) && (value.startsWith('sb_publishable_') || value.startsWith('eyJ')));
}

const missingConfiguration: string[] = [];
if (!isValidSupabaseUrl(supabaseUrl)) missingConfiguration.push('EXPO_PUBLIC_SUPABASE_URL');
if (!isValidPublishableKey(supabasePublishableKey)) missingConfiguration.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

export const isSupabaseConfigured = missingConfiguration.length === 0;
export const supabaseConfigurationMessage = isSupabaseConfigured
  ? ''
  : `Falta configurar ${missingConfiguration.join(' e ')} no arquivo .env. Copie os valores em Supabase > Project Settings > API e reinicie o Expo.`;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: {
          getItem: SecureStore.getItemAsync,
          setItem: SecureStore.setItemAsync,
          removeItem: SecureStore.deleteItemAsync,
        } } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;
