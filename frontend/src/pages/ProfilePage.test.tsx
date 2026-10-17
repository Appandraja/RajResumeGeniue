import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProfilePage from './ProfilePage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      full_name: 'Alice Johnson',
      email: 'alice@example.com',
      oauth_provider: null,
      created_at: '2026-01-05T00:00:00Z',
    },
    updateProfile: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('ProfilePage', () => {
  it('renders avatar initials, name, email and a sign out button', () => {
    render(
      <ChakraProvider>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </ChakraProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Alice Johnson' })).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('AJ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
