import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, type AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authService from '../services/authService';
import { theme } from '../theme';
import ResetPasswordPage from './ResetPasswordPage';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../services/authService', async () => {
  const actual =
    await vi.importActual<typeof import('../services/authService')>('../services/authService');
  return { ...actual, resetPassword: vi.fn() };
});

const renderPage = () =>
  render(
    <ChakraProvider theme={theme}>
      <MemoryRouter initialEntries={[{ pathname: '/reset-password', state: { email: 'ada@b.co' } }]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

async function fillPasswords(password: string, confirm: string): Promise<void> {
  await userEvent.type(screen.getByLabelText(/^new password/i), password);
  await userEvent.type(screen.getByLabelText(/^confirm new password/i), confirm);
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(authService.resetPassword).mockReset();
  });

  it('prefills email from router state and accepts a pasted code with spaces', async () => {
    renderPage();
    expect(screen.getByLabelText(/^email/i)).toHaveValue('ada@b.co');
    const code = screen.getByLabelText(/^reset code/i);
    expect(code).toHaveAttribute('inputmode', 'numeric');
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    await userEvent.click(code);
    await userEvent.paste('1234 5678');
    expect(code).toHaveValue('12345678');
  });

  it('shows a mismatch error and does not submit', async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText(/^reset code/i), '12345678');
    await fillPasswords('Password1!', 'Different1!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('submits and navigates to login with a success flash', async () => {
    vi.mocked(authService.resetPassword).mockResolvedValue(undefined);
    renderPage();
    await userEvent.type(screen.getByLabelText(/^reset code/i), '12345678');
    await fillPasswords('Password1!', 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));
    await waitFor(() =>
      expect(authService.resetPassword).toHaveBeenCalledWith({
        email: 'ada@b.co',
        code: '12345678',
        newPassword: 'Password1!',
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { passwordReset: true },
    });
  });

  it('shows the server error and keeps the form', async () => {
    const error = new AxiosError('bad', '400', undefined, undefined, {
      status: 400,
      data: { error: { code: 'invalid_code', message: 'That code is invalid or has expired.' } },
    } as AxiosResponse);
    vi.mocked(authService.resetPassword).mockRejectedValue(error);
    renderPage();
    await userEvent.type(screen.getByLabelText(/^reset code/i), '12345678');
    await fillPasswords('Password1!', 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: /reset password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That code is invalid or has expired.',
    );
    expect(screen.getByLabelText(/^reset code/i)).toHaveValue('12345678');
    expect(navigate).not.toHaveBeenCalled();
  });
});
