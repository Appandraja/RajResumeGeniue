import axios from 'axios';
import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, clearTokens, setTokens } from './api';
import { isNativeApp } from '../lib/platform';
import type { AuthTokens, User } from '../types';

const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
  detail?: string;
}

/** Extracts a human readable message from an API error. */
export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    if (body?.error?.message) return body.error.message;
    if (typeof body?.detail === 'string') return body.detail;
    if (!error.response) return 'Unable to reach the server. Check your connection.';
  }
  return fallback;
}

export async function register(payload: RegisterPayload): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/register', payload);
  setTokens(data);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/login', payload);
  setTokens(data);
  return data;
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refresh_token: refreshToken });
    }
  } catch {
    // Token revocation is best effort; local sign-out must always succeed.
  } finally {
    clearTokens();
  }
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  return data;
}

export async function updateMe(payload: { full_name: string }): Promise<User> {
  const { data } = await api.put<User>('/auth/me', payload);
  return data;
}

/** Google sign-in start URL. The Android app asks for a deep-link return via `client=mobile`. */
export function googleLoginUrl(): string {
  const base = `${API_URL}/auth/google`;
  return isNativeApp() ? `${base}?client=mobile` : base;
}

export function hasStoredSession(): boolean {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
}
