import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * =========================================================================
 * SECURE STORAGE ADAPTER (Modul 4: Expo SecureStore)
 * Menyimpan token & sesi sensitif terenkripsi di Keychain iOS / Keystore Android.
 * Pada platform Web, otomatis menggunakan window.localStorage agar kompatibel.
 * Mendukung chunking otomatis jika nilai melebihi batas 2048 byte SecureStore.
 * =========================================================================
 */

const CHUNK_SIZE = 1800;
const CHUNK_META_PREFIX = '__chunked__:';

async function setRawItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getRawItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  }
  return await SecureStore.getItemAsync(key);
}

async function deleteRawItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function clearPreviousChunks(key: string): Promise<void> {
  const existing = await getRawItem(key);
  if (existing && existing.startsWith(CHUNK_META_PREFIX)) {
    const count = parseInt(existing.slice(CHUNK_META_PREFIX.length), 10) || 0;
    for (let i = 0; i < count; i++) {
      await deleteRawItem(`${key}_chunk_${i}`);
    }
  }
}

export const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = await getRawItem(key);
      if (!value) return null;

      if (value.startsWith(CHUNK_META_PREFIX)) {
        const count = parseInt(value.slice(CHUNK_META_PREFIX.length), 10) || 0;
        let combined = '';
        for (let i = 0; i < count; i++) {
          const chunk = await getRawItem(`${key}_chunk_${i}`);
          if (chunk === null) return null;
          combined += chunk;
        }
        return combined;
      }

      return value;
    } catch (error) {
      console.warn('SecureStore getItem error:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await clearPreviousChunks(key);

      if (Platform.OS === 'web' || value.length <= CHUNK_SIZE) {
        await setRawItem(key, value);
        return;
      }

      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE));
      }

      for (let i = 0; i < chunks.length; i++) {
        await setRawItem(`${key}_chunk_${i}`, chunks[i]);
      }
      await setRawItem(key, `${CHUNK_META_PREFIX}${chunks.length}`);
    } catch (error) {
      console.warn('SecureStore setItem error:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await clearPreviousChunks(key);
      await deleteRawItem(key);
    } catch (error) {
      console.warn('SecureStore removeItem error:', error);
    }
  },
};

const AUTH_TOKEN_KEY = 'edustock_auth_token';

export async function saveAuthToken(token: string): Promise<void> {
  await ExpoSecureStoreAdapter.setItem(AUTH_TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  return await ExpoSecureStoreAdapter.getItem(AUTH_TOKEN_KEY);
}

export async function deleteAuthToken(): Promise<void> {
  await ExpoSecureStoreAdapter.removeItem(AUTH_TOKEN_KEY);
}
