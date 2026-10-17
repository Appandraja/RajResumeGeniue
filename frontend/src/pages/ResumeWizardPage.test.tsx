import { ChakraProvider } from '@chakra-ui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportedDraftNavState } from '../types/importer';
import ResumeWizardPage from './ResumeWizardPage';

vi.mock('../services/resumeService', () => ({
  listTemplatesForPicker: vi.fn().mockResolvedValue([]),
  createResume: vi.fn(),
  addSection: vi.fn(),
  getApiErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

function StateProbe() {
  const location = useLocation();
  return <div data-testid="nav-state">{JSON.stringify(location.state)}</div>;
}

const navState: ImportedDraftNavState = {
  sourceFileName: 'jane-cv.pdf',
  warnings: ['No dates found for 2 entries'],
  importedDraft: {
    title: 'Jane CV',
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    location: null,
    linkedin_url: null,
    website_url: null,
    summary: 'Engineer.',
    skills: ['Python'],
    sections: [],
  },
};

const renderWizard = (state?: unknown) =>
  render(
    <ChakraProvider>
      <MemoryRouter initialEntries={[{ pathname: '/resumes/new', state }]}>
        <Routes>
          <Route
            path="/resumes/new"
            element={
              <>
                <ResumeWizardPage />
                <StateProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );

describe('ResumeWizardPage import prefill', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prefills fields, shows the banner with warnings, and clears nav state', async () => {
    renderWizard(navState);
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Doe');
    expect(screen.getByLabelText(/^email/i)).toHaveValue('jane@example.com');
    expect(screen.getByLabelText(/resume name/i)).toHaveValue('Jane CV');
    expect(screen.getByText(/imported from jane-cv\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/please review everything before saving/i)).toBeInTheDocument();
    expect(screen.getByText('No dates found for 2 entries')).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.getByTestId('nav-state')).toHaveTextContent('null'));
    // Still prefilled after the state was cleared.
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Doe');

    await userEvent.click(screen.getByRole('button', { name: /dismiss import notice/i }));
    expect(screen.queryByText(/imported from/i)).not.toBeInTheDocument();
  });

  it('works without nav state (refresh)', () => {
    renderWizard(undefined);
    expect(screen.getByLabelText(/full name/i)).toHaveValue('');
    expect(screen.queryByText(/imported from/i)).not.toBeInTheDocument();
  });

  it('ignores unrelated nav state', () => {
    renderWizard({ something: 'else' });
    expect(screen.getByLabelText(/full name/i)).toHaveValue('');
  });

  it('has an optional job description step before the template step', async () => {
    renderWizard(navState);
    for (let i = 0; i < 5; i += 1) {
      await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
    }
    expect(screen.getByLabelText(/paste the job description/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Optional. We use it to show how well your resume matches and what to improve.',
      ),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/paste the job description/i), 'Hello');
    expect(screen.getByText(/5 \/ 20,000 characters/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('button', { name: /create resume/i })).toBeInTheDocument();
  });
});
