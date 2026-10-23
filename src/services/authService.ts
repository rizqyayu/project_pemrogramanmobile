import AsyncStorage from '@react-native-async-storage/async-storage';
import rawInventoryData from '../data/inventoryData.json';
import { User, AuthSession, LoginResult } from '../types';

const STORAGE_KEY_TOKEN = '@edustock_auth_token';
const STORAGE_KEY_USER = '@edustock_auth_user';

// In-memory fallback untuk keamanan & performa
let memorySession: AuthSession | null = null;

/**
 * =========================================================================
 * AUTHENTICATION & TOKEN SERVICE
 * Memenuhi rubrik: Autentikasi dan Token, Custom Functions & Types
 * =========================================================================
 */

// Helper Base64 Cross-Platform (Kompatibel dengan Web, Android, iOS, Hermes)
function safeBase64Encode(str: string): string {
  try {
    if (typeof btoa === 'function') {
      return btoa(str);
    }
  } catch {}
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
       str.charAt(i | 0) || (map = '=', i % 1);
       output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3/4);
    block = block << 8 | charCode;
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
  let str = input.replace(/=+$/, '');
  let output = '';
  for (let bc = 0, bs = 0, buffer, i = 0;
       buffer = str.charAt(i++);
       ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
         bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

/**
 * Custom Function: Membuat Token JWT Mock (Header.Payload.Signature)
 */
export function generateToken(user: User): string {
  // 1. JWT Header (Base64)
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = safeBase64Encode(JSON.stringify(header));

  // 2. JWT Payload dengan Expiration 7 hari (Base64)
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  };
  const encodedPayload = safeBase64Encode(JSON.stringify(payload));

  // 3. JWT Signature simulation
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
 * Custom Function: Autentikasi Login dengan Kredensial dan Penerbitan Token
 */
export async function authenticateUser(
  usernameInput: string,
  passwordInput: string
): Promise<LoginResult> {
  const users: User[] = rawInventoryData.users as User[];
  const trimmedUser = usernameInput.trim().toLowerCase();

  // Penerapan loop untuk mencari user yang cocok
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

  // Buat Token baru
  const token = generateToken(matchedUser);
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
  };

  // Simpan Token & Session ke AsyncStorage
  await saveSession(session);

  return {
    success: true,
    message: 'Login berhasil! Token autentikasi diterbitkan.',
    session,
  };
}

/**
 * Custom Function: Login Cepat Akun Demo (Development Mode)
 */
export async function loginAsDemo(roleKey: 'admin' | 'staff' | 'manager'): Promise<AuthSession> {
  const users: User[] = rawInventoryData.users as User[];
  const targetUser = users.find((u) => u.username === roleKey) || users[0];

  const token = generateToken(targetUser);
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
  };

  await saveSession(session);
  return session;
}

/**
 * Custom Function: Simpan Session & Token ke Persistent Storage
 */
export async function saveSession(session: AuthSession): Promise<void> {
  try {
    memorySession = session;
    await AsyncStorage.setItem(STORAGE_KEY_TOKEN, session.token);
    await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(session.user));
  } catch (err) {
    console.error('Error saving session to storage:', err);
  }
}

/**
 * Custom Function: Ambil Session aktif dari Storage
 */
export async function getSavedSession(): Promise<AuthSession | null> {
  if (memorySession) {
    return memorySession;
  }

  try {
    const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
    const userJson = await AsyncStorage.getItem(STORAGE_KEY_USER);

    if (token && userJson) {
      const user: User = JSON.parse(userJson);
      memorySession = {
        user,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      return memorySession;
    }
  } catch (err) {
    console.warn('Error reading session from storage:', err);
  }

  return null;
}

/**
 * Custom Function: Mengambil Header Authorization Bearer Token
 * Digunakan untuk pemanggilan HTTP / API
 */
export async function getAuthHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const session = await getSavedSession();
  if (session?.token) {
    return { Authorization: `Bearer ${session.token}` };
  }
  return {};
}

/**
 * Custom Function: Logout dan hapus token dari storage
 */
export async function logout(): Promise<void> {
  try {
    memorySession = null;
    await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEY_USER);
  } catch (err) {
    console.error('Error clearing session:', err);
  }
}
