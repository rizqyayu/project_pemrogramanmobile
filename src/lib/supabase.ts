import { createClient } from '@supabase/supabase-js';
import { ExpoSecureStoreAdapter } from '../services/secureStorage';

/**
 * =========================================================================
 * SUPABASE SINGLETON CLIENT (Modul 4: Cloud Bridge & Adapter SecureStore)
 * Kredensial dibaca aman dari environment variable (.env) dengan awalan EXPO_PUBLIC_.
 * =========================================================================
 */

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

const isPlaceholderUrl =
  !rawUrl ||
  rawUrl.includes('your-project') ||
  rawUrl.includes('xxxxxxxxxxxxxx') ||
  !rawUrl.startsWith('https://');

const isPlaceholderKey =
  !rawAnonKey || rawAnonKey === 'your-supabase-anon-key' || rawAnonKey.length < 20;

export const isSupabaseConfigured: boolean = !isPlaceholderUrl && !isPlaceholderKey;

// Fallback URL sementara agar createClient tidak melempar error saat .env belum diisi
const safeSupabaseUrl = isSupabaseConfigured ? rawUrl : 'https://placeholder.supabase.co';
const safeSupabaseAnonKey = isSupabaseConfigured ? rawAnonKey : 'placeholder-anon-key';

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getSupabaseConfigStatus(): {
  configured: boolean;
  url: string;
} {
  return {
    configured: isSupabaseConfigured,
    url: rawUrl,
  };
}
