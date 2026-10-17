import { ChakraProvider } from '@chakra-ui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authService from '../services/authService';
import { theme } from '../theme';
import ForgotPasswordPage from './ForgotPasswordPage';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../services/authService', async () => {
  const actual =
    await vi.importActual<typeof import('../services/authService')>('../services/authService');
  return { ...actual, requestPasswordReset: vi.fn() };
});

const renderPage = () =>
  render(
    <ChakraProvider theme={theme}>
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

async function submitEmail(address: string): Promise<void> {
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: address } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /send reset code/i }));
  });
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(authService.requestPasswordReset).mockResolvedValue(undefined);
    navigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates the email', async () => {
    renderPage();
    await submitEmail('nope');
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows a neutral confirmation, then a resend cooldown and Enter code navigation', async () => {
    renderPage();
    await submitEmail('ada@example.com');
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('ada@example.com');
    expect(screen.getByText(/If an account exists for/i)).toBeInTheDocument();
    expect(screen.getByText(/It expires in 15\s+minutes/i)).toBeInTheDocument();
    expect(screen.queryByText(/no account|not found|does not exist/i)).not.toBeInTheDocument();

    const resend = screen.getByRole('button', { name: /resend in 30s/i });
    expect(resend).toBeDisabled();

    for (let i = 0; i < 30; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    const ready = screen.getByRole('button', { name: /resend code/i });
    expect(ready).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /enter code/i }));
    expect(navigate).toHaveBeenCalledWith('/reset-password', {
      state: { email: 'ada@example.com' },
    });
  });
});
