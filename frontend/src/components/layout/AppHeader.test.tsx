import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

const logout = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { full_name: 'Alice Johnson', email: 'alice@example.com' },
    logout,
  }),
}));

const renderAt = (path: string) =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<p>dashboard page</p>} />
            <Route path="/resumes" element={<p>resumes page</p>} />
            <Route path="/resumes/import" element={<p>import page</p>} />
          </Route>
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logout.mockResolvedValue(undefined);
  });

  // The desktop nav is `display: none` below the md breakpoint, which jsdom applies, so
  // role/name queries (accessible names are empty for hidden nodes) cannot find it.
  const mainNav = (): HTMLElement => {
    const nav = screen
      .getAllByRole('navigation', { hidden: true })
      .find((el) => el.getAttribute('aria-label') === 'Main');
    if (!nav) throw new Error('Main navigation landmark not found');
    return nav;
  };

  it('shows nav links and the user initials', () => {
    renderAt('/dashboard');
    const nav = mainNav();
    const expected: Record<string, string> = {
      Dashboard: '/dashboard',
      'My resumes': '/resumes',
      Templates: '/templates',
      Import: '/resumes/import',
    };
    for (const [label, href] of Object.entries(expected)) {
      expect(within(nav).getByText(label).closest('a')).toHaveAttribute('href', href);
    }
    expect(screen.getByText('AJ')).toBeInTheDocument();
    expect(screen.getByText('dashboard page')).toBeInTheDocument();
  });

  it('marks the active link with aria-current', () => {
    renderAt('/resumes/import');
    const nav = mainNav();
    expect(within(nav).getByText('Import').closest('a')).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByText('My resumes').closest('a')).not.toHaveAttribute('aria-current');
  });

  it('signs out from the user menu and goes to /login', async () => {
    // Chakra's menu list is pointer-events:none while its open animation runs; jsdom never
    // finishes that animation, so skip user-event's pointer-events guard here.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderAt('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    // The menu list animates in; wait for the item instead of querying it synchronously.
    const signOut = await screen.findByText(/^sign out$/i, undefined, { timeout: 3000 });
    await user.click(signOut);
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('has a Sign out button in the mobile drawer', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /sign out/i }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
