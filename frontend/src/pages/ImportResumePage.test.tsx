import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as importService from '../services/importService';
import type { ImportResult } from '../types/importer';
import ImportResumePage from './ImportResumePage';

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('../services/importService', async () => {
  const actual =
    await vi.importActual<typeof import('../services/importService')>('../services/importService');
  return { ...actual, importResume: vi.fn() };
});

const result: ImportResult = {
  draft: {
    title: 'Ada Lovelace',
    full_name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    location: null,
    linkedin_url: null,
    website_url: null,
    summary: null,
    skills: ['Math'],
    sections: [],
  },
  warnings: ['No dates found for 1 entry'],
  source_format: 'pdf',
  char_count: 500,
};

function renderPage() {
  return render(
    <ChakraProvider>
      <MemoryRouter>
        <ImportResumePage />
      </MemoryRouter>
    </ChakraProvider>,
  );
}

async function pick(file: File): Promise<void> {
  const input = screen.getByTestId('import-file-input');
  // applyAccept: false so the wrong-type case reaches validation like a drag-and-drop would.
  await userEvent.setup({ applyAccept: false }).upload(input, file);
}

describe('ImportResumePage', () => {
  beforeEach(() => {
    navigate.mockReset();
    vi.mocked(importService.importResume).mockReset();
  });

  it('shows formats, limit and privacy note', () => {
    renderPage();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText(/up to 5 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/not stored/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start from scratch/i })).toHaveAttribute(
      'href',
      '/resumes/new',
    );
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('rejects an unsupported file with a message', async () => {
    renderPage();
    await pick(new File(['x'], 'photo.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not supported/i);
    expect(screen.queryByTestId('selected-file')).not.toBeInTheDocument();
    expect(importService.importResume).not.toHaveBeenCalled();
  });

  it('shows the selected file and lets the user remove it', async () => {
    renderPage();
    await pick(new File(['hello'], 'cv.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText('cv.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByText('cv.pdf')).not.toBeInTheDocument();
  });

  it('imports and navigates to the wizard with the draft in state', async () => {
    vi.mocked(importService.importResume).mockResolvedValue(result);
    renderPage();
    await pick(new File(['hello'], 'cv.pdf', { type: 'application/pdf' }));
    await screen.findByText('cv.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith('/resumes/new', {
      state: {
        importedDraft: result.draft,
        warnings: result.warnings,
        sourceFileName: 'cv.pdf',
      },
    });
  });

  it('shows the server error text and does not navigate', async () => {
    vi.mocked(importService.importResume).mockRejectedValue(
      new Error('This PDF looks scanned. Please upload a text-based file.'),
    );
    renderPage();
    await pick(new File(['hello'], 'scan.pdf', { type: 'application/pdf' }));
    await screen.findByText('scan.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/looks scanned/);
    expect(navigate).not.toHaveBeenCalled();
  });
});
