import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTokens, setTokens } from '../services/api';
import * as authService from '../services/authService';
import type { User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from './AuthContext';

vi.mock('../services/api', () => ({
  clearTokens: vi.fn(),
  setTokens: vi.fn(),
}));

vi.mock('../services/authService', () => ({
  hasStoredSession: vi.fn(),
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateMe: vi.fn(),
}));

const alice: User = {
  id: 1,
  email: 'alice@example.com',
  full_name: 'Alice',
  is_active: true,
  is_verified: false,
  oauth_provider: null,
  created_at: '2026-01-01T00:00:00Z',
};

function statusOf(isLoading: boolean, user: User | null): string {
  if (isLoading) return 'loading';
  return user ? `in:${user.email}` : 'out';
}

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">{statusOf(auth.isLoading, auth.user)}</p>
      <p data-testid="name">{auth.user?.full_name ?? ''}</p>
      <button onClick={() => void auth.login('alice@example.com', 'pw')}>login</button>
      <button onClick={() => void auth.logout()}>logout</button>
      <button onClick={() => void auth.updateProfile('Alicia')}>rename</button>
      <button
        onClick={() =>
          void auth
            .loginWithTokens({ access_token: 'a', refresh_token: 'r' })
            .catch(() => undefined)
        }
      >
        tokens
      </button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.hasStoredSession).mockReturnValue(false);
  });

  it('starts logged out without a stored session and does not call the API', () => {
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(authService.getMe).not.toHaveBeenCalled();
  });

  it('restores the user from a stored session', async () => {
    vi.mocked(authService.hasStoredSession).mockReturnValue(true);
    vi.mocked(authService.getMe).mockResolvedValue(alice);
    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('in:alice@example.com'),
    );
  });

  it('clears tokens when the stored session is rejected', async () => {
    vi.mocked(authService.hasStoredSession).mockReturnValue(true);
    vi.mocked(authService.getMe).mockRejectedValue(new Error('401'));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'));
    expect(clearTokens).toHaveBeenCalled();
  });

  it('login loads the user, logout clears it', async () => {
    vi.mocked(authService.login).mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      token_type: 'bearer',
    });
    vi.mocked(authService.getMe).mockResolvedValue(alice);
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    renderProvider();
    await userEvent.click(screen.getByText('login'));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('in:alice@example.com'),
    );
    expect(authService.login).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'pw' });

    await userEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('out'));
  });

  it('updateProfile replaces the user', async () => {
    vi.mocked(authService.updateMe).mockResolvedValue({ ...alice, full_name: 'Alicia' });
    renderProvider();
    await userEvent.click(screen.getByText('rename'));
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Alicia'));
    expect(authService.updateMe).toHaveBeenCalledWith({ full_name: 'Alicia' });
  });

  it('loginWithTokens stores tokens and loads the user', async () => {
    vi.mocked(authService.getMe).mockResolvedValue(alice);
    renderProvider();
    await userEvent.click(screen.getByText('tokens'));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('in:alice@example.com'),
    );
    expect(setTokens).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('loginWithTokens clears tokens if the profile cannot be loaded', async () => {
    vi.mocked(authService.getMe).mockRejectedValue(new Error('nope'));
    renderProvider();
    await userEvent.click(screen.getByText('tokens'));
    await waitFor(() => expect(clearTokens).toHaveBeenCalled());
    expect(screen.getByTestId('status')).toHaveTextContent('out');
  });
});

describe('useAuth', () => {
  it('throws outside the provider', () => {
    const spy = vi.spyOn(globalThis.console, 'error').mockImplementation(() => undefined);
    const swallow = (event: ErrorEvent): void => event.preventDefault();
    window.addEventListener('error', swallow);
    expect(() => render(<Probe />)).toThrow('useAuth must be used within an AuthProvider');
    window.removeEventListener('error', swallow);
    spy.mockRestore();
  });
});
