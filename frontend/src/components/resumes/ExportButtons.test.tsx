import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadResume } from '../../services/exportService';
import { ExportButtons } from './ExportButtons';

vi.mock('../../services/exportService', () => ({
  downloadResume: vi.fn(),
}));

const renderButtons = () =>
  render(
    <ChakraProvider>
      <ExportButtons resumeId={5} />
    </ChakraProvider>,
  );

describe('ExportButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('downloads a PDF, disables both buttons while loading, then toasts success', async () => {
    let resolve: () => void = () => undefined;
    vi.mocked(downloadResume).mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    renderButtons();
    await userEvent.click(screen.getByRole('button', { name: /download resume as pdf/i }));

    expect(downloadResume).toHaveBeenCalledWith(5, 'pdf');
    expect(await screen.findByText('Preparing PDF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /word document/i })).toBeDisabled();

    resolve();
    expect(await screen.findByText('PDF downloaded')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Preparing PDF')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /word document/i })).toBeEnabled();
  });

  it('downloads DOCX', async () => {
    vi.mocked(downloadResume).mockResolvedValue(undefined);
    renderButtons();
    await userEvent.click(screen.getByRole('button', { name: /word document/i }));
    expect(downloadResume).toHaveBeenCalledWith(5, 'docx');
    expect(await screen.findByText('DOCX downloaded')).toBeInTheDocument();
  });

  it('shows an error toast with the service message and re-enables the buttons', async () => {
    vi.mocked(downloadResume).mockRejectedValue(new Error('Resume not found'));
    renderButtons();
    await userEvent.click(screen.getByRole('button', { name: /download resume as pdf/i }));
    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(screen.getByText('Resume not found')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download resume as pdf/i })).toBeEnabled(),
    );
  });
});
