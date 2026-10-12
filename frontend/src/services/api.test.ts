import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './api';

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    data: {},
    headers: {},
    config,
  });
}

describe('api refresh handling', () => {
  beforeEach(() => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'expired-access');
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shares a single refresh request between parallel 401 responses', async () => {
    const refreshSpy = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { access_token: 'fresh-access', refresh_token: 'refresh-2', token_type: 'bearer' },
    });

    const adapter: AxiosAdapter = async (config) => {
      const header = String(config.headers.Authorization ?? '');
      if (header !== 'Bearer fresh-access') {
        throw unauthorized(config);
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    const results = await Promise.all(
      [1, 2, 3].map(() => api.get('/api/resumes', { adapter })),
    );

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-2');
  });

  it('clears tokens when the refresh itself fails', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh rejected'));
    const adapter: AxiosAdapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(api.get('/api/resumes', { adapter })).rejects.toThrow();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
});
