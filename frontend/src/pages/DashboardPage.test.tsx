import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as resumeService from '../services/resumeService';
import type { Resume } from '../types';
import DashboardPage from './DashboardPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { full_name: 'Alice', email: 'alice@example.com' } }),
}));

vi.mock('../services/templateService', () => ({
  listTemplates: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/resumeService', () => ({
  listResumes: vi.fn(),
  deleteResume: vi.fn(),
  duplicateResume: vi.fn(),
  getApiErrorMessage: (_err: unknown, fallback: string) => fallback,
}));

const resume: Resume = {
  id: 3,
  user_id: 1,
  template_id: 1,
  title: 'Platform Engineer',
  full_name: null,
  email: null,
  phone: null,
  location: null,
  linkedin_url: null,
  website_url: null,
  summary: null,
  skills: [],
  ats_score: 82,
  sections: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

const renderPage = () =>
  render(
    <ChakraProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('greets the user and shows the empty state for a new account', async () => {
    vi.mocked(resumeService.listResumes).mockResolvedValue([]);
    renderPage();
    expect(screen.getByText('Welcome back, Alice')).toBeInTheDocument();
    expect(await screen.findByTestId('dashboard-empty')).toBeInTheDocument();
    expect(screen.queryByText('Average ATS score')).not.toBeInTheDocument();
  });

  it('shows stats and recent resumes when resumes exist', async () => {
    vi.mocked(resumeService.listResumes).mockResolvedValue([resume]);
    renderPage();
    expect(await screen.findByText('Platform Engineer')).toBeInTheDocument();
    expect(screen.getByText('Average ATS score')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-empty')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that reloads', async () => {
    vi.mocked(resumeService.listResumes)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load your resumes. Please try again.',
    );
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('dashboard-empty')).toBeInTheDocument();
  });
});
