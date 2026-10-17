import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

const authState: AuthState = { isAuthenticated: false, isLoading: false };

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? 'none';
  return <p>Login page (from: {from})</p>;
}

const renderAt = (path: string) =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <p>Secret dashboard</p>
              </ProtectedRoute>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route path="/resumes" element={<p>Resume list</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    authState.isAuthenticated = false;
    authState.isLoading = false;
  });

  it('redirects anonymous visitors to /login and remembers the origin', () => {
    renderAt('/dashboard');
    expect(screen.getByText('Login page (from: /dashboard)')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('shows a spinner (not the page, not a redirect) while the session loads', () => {
    authState.isLoading = true;
    renderAt('/dashboard');
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText(/Login page/)).not.toBeInTheDocument();
    expect(screen.getByText('Loading your session')).toBeInTheDocument();
  });

  it('renders children for authenticated users', () => {
    authState.isAuthenticated = true;
    renderAt('/dashboard');
    expect(screen.getByText('Secret dashboard')).toBeInTheDocument();
  });

  it('works as a layout route', () => {
    authState.isAuthenticated = true;
    renderAt('/resumes');
    expect(screen.getByText('Resume list')).toBeInTheDocument();
  });

  it('redirects layout-route children when anonymous', () => {
    renderAt('/resumes');
    expect(screen.getByText('Login page (from: /resumes)')).toBeInTheDocument();
  });
});
