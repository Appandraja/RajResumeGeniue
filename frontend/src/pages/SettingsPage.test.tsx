import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as accountService from '../services/accountService';
import SettingsPage from './SettingsPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { full_name: 'Alice', email: 'alice@example.com' },
    updateProfile: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../services/accountService', () => ({ changePassword: vi.fn() }));

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

async function fill(current: string, next: string, confirm: string): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^current password/i), current);
  await user.type(screen.getByLabelText(/^new password/i), next);
  await user.type(screen.getByLabelText(/^confirm new password/i), confirm);
  await user.click(screen.getByRole('button', { name: /update password/i }));
}

describe('SettingsPage change password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects mismatched passwords', async () => {
    renderPage();
    await fill('oldpassword', 'newpassword1', 'different123');
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(accountService.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a too-short new password', async () => {
    renderPage();
    await fill('oldpassword', 'short', 'short');
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(accountService.changePassword).not.toHaveBeenCalled();
  });

  it('submits, clears the form and confirms on success', async () => {
    vi.mocked(accountService.changePassword).mockResolvedValue(undefined);
    renderPage();
    await fill('oldpassword', 'newpassword1', 'newpassword1');
    await waitFor(() =>
      expect(accountService.changePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword1',
      }),
    );
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
    expect(screen.getByLabelText(/^current password/i)).toHaveValue('');
  });

  it('shows the server error message', async () => {
    const err = new AxiosError('bad', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 400,
      data: { error: { message: 'Current password is incorrect.' } },
    } as AxiosResponse);
    vi.mocked(accountService.changePassword).mockRejectedValue(err);
    renderPage();
    await fill('wrongpass', 'newpassword1', 'newpassword1');
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderPage();
    const input = screen.getByLabelText(/^current password/i);
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show current password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});
