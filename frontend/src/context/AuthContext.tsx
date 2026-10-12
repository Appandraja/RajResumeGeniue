import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearTokens, setTokens } from '../services/api';
import * as authService from '../services/authService';
import type { AuthTokens, User } from '../types';

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Stores tokens (e.g. from the OAuth callback) and loads the user. */
  loginWithTokens: (tokens: Pick<AuthTokens, 'access_token' | 'refresh_token'>) => Promise<void>;
  updateProfile: (fullName: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(authService.hasStoredSession());

  useEffect(() => {
    let cancelled = false;
    if (!authService.hasStoredSession()) {
      return;
    }
    authService
      .getMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        clearTokens();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    await authService.login({ email, password });
    setUser(await authService.getMe());
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName: string): Promise<void> => {
      await authService.register({ email, password, full_name: fullName });
      setUser(await authService.getMe());
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    await authService.logout();
    setUser(null);
  }, []);

  const loginWithTokens = useCallback(
    async (tokens: Pick<AuthTokens, 'access_token' | 'refresh_token'>): Promise<void> => {
      setTokens(tokens);
      try {
        setUser(await authService.getMe());
      } catch (error) {
        clearTokens();
        throw error;
      }
    },
    [],
  );

  const updateProfile = useCallback(async (fullName: string): Promise<void> => {
    setUser(await authService.updateMe({ full_name: fullName }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      loginWithTokens,
      updateProfile,
    }),
    [user, isLoading, login, register, logout, loginWithTokens, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
