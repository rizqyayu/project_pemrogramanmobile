import { Session } from '@supabase/supabase-js';
import rawInventoryData from '../data/inventoryData.json';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthSession, LoginResult, User, UserRole } from '../types';
import {
  ExpoSecureStoreAdapter,
  deleteAuthToken,
  saveAuthToken,
} from './secureStorage';

const STORAGE_KEY_TOKEN = 'edustock_auth_token';
const STORAGE_KEY_USER = 'edustock_auth_user';
const STORAGE_KEY_IS_DEMO = 'edustock_auth_is_demo';

// In-memory fallback untuk keamanan & performa
let memorySession: AuthSession | null = null;

/**
 * =========================================================================
 * AUTHENTICATION & TOKEN SERVICE
 * Memenuhi rubrik: Autentikasi dan Token, Custom Functions & Types
 * =========================================================================
 */

function safeBase64Encode(str: string): string {
  try {
    if (typeof btoa === 'function') {
      return btoa(str);
    }
  } catch {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (
    let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || ((map = '='), i % 1);
    output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))
  ) {
    charCode = str.charCodeAt((i += 3 / 4));
    block = (block << 8) | charCode;
  }
  return output;
}

function safeBase64Decode(input: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(input);
    }
  } catch {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = input.replace(/=+$/, '');
  let output = '';
  for (
    let bc = 0, bs = 0, buffer, i = 0;
    (buffer = str.charAt(i++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Custom Function: Membuat Token JWT Mock (Header.Payload.Signature)
 */
export function generateToken(user: User, isDemo: boolean = false): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = safeBase64Encode(JSON.stringify(header));

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
    isDemo,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
  const encodedPayload = safeBase64Encode(JSON.stringify(payload));
  const signature = 'edustock_signature_' + Math.random().toString(36).substring(2, 10);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Custom Function: Decode Token JWT untuk mengekstrak informasi payload
 */
export function decodeToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payloadStr = safeBase64Decode(parts[1]);
      return JSON.parse(payloadStr);
    }
  } catch (error) {
    console.warn('Gagal decode token:', error);
  }
  return null;
}

/**
 * Autentikasi Login Manual (Kredensial Akun Reguler/Produksi -> isDemo: false)
 */
export async function authenticateUser(
  usernameInput: string,
  passwordInput: string
): Promise<LoginResult> {
  const users: User[] = rawInventoryData.users as User[];
  const trimmedUser = usernameInput.trim().toLowerCase();

  let matchedUser: User | null = null;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (
      (u.username.toLowerCase() === trimmedUser || u.email.toLowerCase() === trimmedUser) &&
      u.password === passwordInput
    ) {
      matchedUser = u;
      break;
    }
  }

  if (!matchedUser) {
    return {
      success: false,
      message: 'Username/Email atau Password salah! Periksa kembali kredensial Anda.',
    };
  }

  const token = generateToken(matchedUser, false);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const session: AuthSession = {
    user: {
      id: matchedUser.id,
      username: matchedUser.username,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
    },
    token,
    expiresAt,
    isDemo: false,
  };

  await saveSession(session);

  return {
    success: true,
    message: 'Login berhasil! Token autentikasi diterbitkan.',
    session,
  };
}

/**
 * Login Cepat Akun Demo (Simulasi & Pengujian -> isDemo: true)
 */
export async function loginAsDemo(roleKey: 'admin' | 'staff' | 'manager'): Promise<AuthSession> {
  const users: User[] = rawInventoryData.users as User[];
  const targetUser = users.find((u) => u.username === roleKey) || users[0];

  const token = generateToken(targetUser, true);
  const session: AuthSession = {
    user: {
      id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
    },
    token,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    isDemo: true,
  };

  await saveSession(session);
  return session;
}

const VALID_ROLES: UserRole[] = [
  'Admin Gudang',
  'Staff Inventory',
  'Pemilik Toko / Manajer',
];

function normalizeUserRole(rawRole: unknown): UserRole {
  if (typeof rawRole === 'string' && VALID_ROLES.includes(rawRole as UserRole)) {
    return rawRole as UserRole;
  }
  return 'Admin Gudang';
}

function stableNumericId(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

/**
 * Konversi Session Supabase menjadi AuthSession EduStock agar RBAC & seluruh modul tetap kompatibel.
 */
export function mapSupabaseSessionToAuthSession(sbSession: Session): AuthSession {
  const sbUser = sbSession.user;
  const meta = (sbUser.user_metadata || {}) as Record<string, unknown>;
  const email = sbUser.email || 'user@edustock.app';
  const displayName =
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof meta.callsign === 'string' && meta.callsign.trim()) ||
    email.split('@')[0];
  const role = normalizeUserRole(meta.role);
  const username =
    (typeof meta.username === 'string' && meta.username.trim()) ||
    email.split('@')[0];

  return {
    user: {
      id: stableNumericId(sbUser.id),
      authUid: sbUser.id,
      username,
      name: displayName,
      email,
      role,
      aktif: true,
    },
    token: sbSession.access_token,
    expiresAt: sbSession.expires_at
      ? new Date(sbSession.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(),
    isDemo: false,
  };
}

/**
 * Autentikasi Login melalui Supabase Auth (signInWithPassword)
 */
export async function signInWithSupabase(
  emailInput: string,
  passwordInput: string
): Promise<LoginResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      message:
        'Kredensial Supabase (.env) belum diisi. Lengkapi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY terlebih dahulu.',
    };
  }

  const cleanEmail = emailInput.trim();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: passwordInput,
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  if (!data.session) {
    return {
      success: false,
      message: 'Sesi Supabase tidak terbentuk. Periksa status konfirmasi email Anda.',
    };
  }

  const session = mapSupabaseSessionToAuthSession(data.session);
  await saveSession(session);

  return {
    success: true,
    message: 'Login Supabase berhasil! Sesi disimpan aman di SecureStore.',
    session,
  };
}

/**
 * Pendaftaran Akun Baru melalui Supabase Auth (signUp + user_metadata)
 */
export async function signUpWithSupabase(params: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<LoginResult & { needsEmailConfirmation?: boolean }> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      message:
        'Kredensial Supabase (.env) belum diisi. Lengkapi EXPO_PUBLIC_SUPABASE_URL dan EXPO_PUBLIC_SUPABASE_ANON_KEY terlebih dahulu.',
    };
  }

  const cleanEmail = params.email.trim();
  const cleanName = params.name.trim();

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: params.password,
    options: {
      data: {
        name: cleanName,
        callsign: cleanName,
        username: cleanEmail.split('@')[0],
        role: params.role,
      },
    },
  });

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  if (!data.session) {
    return {
      success: true,
      needsEmailConfirmation: true,
      message:
        'Pendaftaran berhasil! Cek email untuk konfirmasi, atau matikan "Confirm email" di Dashboard Supabase agar bisa langsung masuk.',
    };
  }

  const session = mapSupabaseSessionToAuthSession(data.session);
  await saveSession(session);

  return {
    success: true,
    needsEmailConfirmation: false,
    message: 'Pendaftaran berhasil! Akun langsung aktif dan sesi tersimpan aman.',
    session,
  };
}

export async function saveSession(session: AuthSession): Promise<void> {
  try {
    memorySession = session;
    await saveAuthToken(session.token);
    await ExpoSecureStoreAdapter.setItem(STORAGE_KEY_TOKEN, session.token);
    await ExpoSecureStoreAdapter.setItem(STORAGE_KEY_USER, JSON.stringify(session.user));
    await ExpoSecureStoreAdapter.setItem(
      STORAGE_KEY_IS_DEMO,
      session.isDemo ? 'true' : 'false'
    );
  } catch (err) {
    console.error('Error saving session to SecureStore:', err);
  }
}

export async function getSavedSession(): Promise<AuthSession | null> {
  if (memorySession) {
    return memorySession;
  }

  try {
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const sbMapped = mapSupabaseSessionToAuthSession(data.session);
        memorySession = sbMapped;
        return sbMapped;
      }
    }

    const token = await ExpoSecureStoreAdapter.getItem(STORAGE_KEY_TOKEN);
    const userJson = await ExpoSecureStoreAdapter.getItem(STORAGE_KEY_USER);
    const isDemoStr = await ExpoSecureStoreAdapter.getItem(STORAGE_KEY_IS_DEMO);

    if (token && userJson) {
      const user: User = JSON.parse(userJson);
      const decoded = decodeToken(token);
      const isDemo = decoded?.isDemo === true || isDemoStr === 'true';
      memorySession = {
        user,
        token,
        expiresAt: decoded?.exp
          ? new Date(decoded.exp * 1000).toISOString()
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isDemo,
      };
      return memorySession;
    }
  } catch (err) {
    console.warn('Error reading session from SecureStore:', err);
  }

  return null;
}

export async function getAuthHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const session = await getSavedSession();
  if (session?.token) {
    return { Authorization: `Bearer ${session.token}` };
  }
  return {};
}

export async function clearLocalSessionOnly(): Promise<void> {
  try {
    memorySession = null;
    await deleteAuthToken();
    await ExpoSecureStoreAdapter.removeItem(STORAGE_KEY_TOKEN);
    await ExpoSecureStoreAdapter.removeItem(STORAGE_KEY_USER);
    await ExpoSecureStoreAdapter.removeItem(STORAGE_KEY_IS_DEMO);
  } catch (err) {
    console.error('Error clearing SecureStore session:', err);
  }
}

export async function logout(): Promise<void> {
  try {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('Supabase signOut warning:', err);
  } finally {
    await clearLocalSessionOnly();
  }
}
