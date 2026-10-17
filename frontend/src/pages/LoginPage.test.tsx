import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../theme';
import LoginPage from './LoginPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
  }),
}));

const renderPage = (state?: unknown) =>
  render(
    <ChakraProvider theme={theme}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <LoginPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('LoginPage', () => {
  it('shows the password reset success flash', () => {
    renderPage({ passwordReset: true });
    expect(screen.getByText('Password updated. Please sign in.')).toBeInTheDocument();
  });

  it('does not show the flash by default and offers the forgot link', () => {
    renderPage();
    expect(screen.queryByText('Password updated. Please sign in.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });
});
