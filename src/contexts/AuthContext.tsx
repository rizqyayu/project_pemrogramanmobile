import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  authenticateUser,
  clearLocalSessionOnly,
  getSavedSession,
  loginAsDemo,
  logout,
  mapSupabaseSessionToAuthSession,
  saveSession,
  signInWithSupabase,
  signUpWithSupabase,
} from '../services/authService';
import { AuthSession, LoginResult, User, UserRole } from '../types';

/**
 * =========================================================================
 * GLOBAL AUTH CONTEXT (Modul 4: Rehidrasi Sesi & Real-Time Auth Listener)
 * - Memulihkan sesi dari Expo SecureStore saat aplikasi dibuka (cold start)
 * - Berlangganan supabase.auth.onAuthStateChange() untuk pembaruan sesi langsung
 * =========================================================================
 */

interface AuthContextValue {
  session: AuthSession | null;
  user: User | null;
  isLoading: boolean;
  isSupabaseReady: boolean;
  signIn: (email: string, password: string) => Promise<LoginResult>;
  signUp: (params: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }) => Promise<LoginResult & { needsEmailConfirmation?: boolean }>;
  signInLegacy: (username: string, password: string) => Promise<LoginResult>;
  signInDemo: (roleKey: 'admin' | 'staff' | 'manager') => Promise<AuthSession>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const restored = await getSavedSession();
        if (isMounted) {
          setSession(restored);
        }
      } catch (error) {
        console.warn('AuthContext hydrateSession error:', error);
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    if (!isSupabaseConfigured) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sbSession) => {
      if (!isMounted) return;

      if (sbSession) {
        const mapped = mapSupabaseSessionToAuthSession(sbSession);
        await saveSession(mapped);
        if (isMounted) {
          setSession(mapped);
        }
      } else if (event === 'SIGNED_OUT') {
        await clearLocalSessionOnly();
        if (isMounted) {
          setSession(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<LoginResult> => {
    const result = await signInWithSupabase(email, password);
    if (result.success && result.session) {
      setSession(result.session);
    }
    return result;
  };

  const signUp = async (params: {
    email: string;
    password: string;
    name: string;
    role: UserRole;
  }): Promise<LoginResult & { needsEmailConfirmation?: boolean }> => {
    const result = await signUpWithSupabase(params);
    if (result.success && result.session) {
      setSession(result.session);
    }
    return result;
  };

  const signInLegacy = async (username: string, password: string): Promise<LoginResult> => {
    const result = await authenticateUser(username, password);
    if (result.success && result.session) {
      setSession(result.session);
    }
    return result;
  };

  const signInDemo = async (
    roleKey: 'admin' | 'staff' | 'manager'
  ): Promise<AuthSession> => {
    const demoSession = await loginAsDemo(roleKey);
    setSession(demoSession);
    return demoSession;
  };

  const signOut = async (): Promise<void> => {
    await logout();
    setSession(null);
  };

  const refreshSession = async (): Promise<void> => {
    const restored = await getSavedSession();
    setSession(restored);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isSupabaseReady: isSupabaseConfigured,
        signIn,
        signUp,
        signInLegacy,
        signInDemo,
        signOut,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus dipanggil di dalam <AuthProvider>.');
  }
  return ctx;
}
