import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import type { AuthTokens } from '../types';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';

const api = axios.create({
  baseURL: API_URL,
});

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export function setTokens(tokens: Pick<AuthTokens, 'access_token' | 'refresh_token'>): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Refresh tokens rotate on use, so parallel 401s must share ONE refresh request.
 * A second refresh with the already-rotated token is treated as theft by the backend
 * and revokes every session for the user.
 */
let refreshPromise: Promise<AuthTokens> | null = null;

function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  if (refreshPromise === null) {
    refreshPromise = axios
      .post<AuthTokens>(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
      .then(({ data }) => {
        setTokens(data);
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const isRefreshCall = original?.url?.includes('/auth/refresh') ?? false;

    if (error.response?.status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true;
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        clearTokens();
        return Promise.reject(error);
      }
      try {
        await refreshTokens(refreshToken);
        return api(original as AxiosRequestConfig);
      } catch (refreshError) {
        clearTokens();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
