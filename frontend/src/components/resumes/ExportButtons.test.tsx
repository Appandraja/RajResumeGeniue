import { ChakraProvider } from '@chakra-ui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_FORMATS } from '../../lib/exportFormats';
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

const openMenu = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: /^download resume$/i }));
};

describe('ExportButtons format picker', () => {
  beforeEach(() => {
    // jsdom does not implement Element.scrollTo, which the Chakra menu calls when it opens.
    Element.prototype.scrollTo = vi.fn();
    vi.clearAllMocks();
  });

  it('lists all 7 formats with descriptions', async () => {
    renderButtons();
    await openMenu();
    const items = await screen.findAllByRole('menuitem');
    expect(items).toHaveLength(7);
    for (const format of EXPORT_FORMATS) {
      expect(
        screen.getByRole('menuitem', { name: `Download resume as ${format.label}` }),
      ).toBeInTheDocument();
      expect(screen.getByText(format.description)).toBeInTheDocument();
    }
    expect(screen.getByText(/recommended for most applications/i)).toBeInTheDocument();
    expect(screen.getByText(/safest for ATS text boxes/i)).toBeInTheDocument();
  });

  it('downloads the chosen format, shows loading, then toasts success', async () => {
    let resolve: () => void = () => undefined;
    vi.mocked(downloadResume).mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    renderButtons();
    await openMenu();
    await userEvent.click(await screen.findByRole('menuitem', { name: /plain text/i }));

    expect(downloadResume).toHaveBeenCalledWith(5, 'txt');
    expect(await screen.findByText(/Preparing Plain text/)).toBeInTheDocument();

    resolve();
    expect(await screen.findByText('Plain text (.txt) downloaded')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Preparing/)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^download resume$/i })).toBeEnabled();
  });

  it.each(EXPORT_FORMATS.map((f) => [f.id, f.label] as const))(
    'requests %s',
    async (id, label) => {
      vi.mocked(downloadResume).mockResolvedValue(undefined);
      renderButtons();
      await openMenu();
      await userEvent.click(
        await screen.findByRole('menuitem', { name: `Download resume as ${label}` }),
      );
      expect(downloadResume).toHaveBeenCalledWith(5, id);
    },
  );

  it('shows an error toast with the service message and re-enables the button', async () => {
    vi.mocked(downloadResume).mockRejectedValue(new Error('Resume not found'));
    renderButtons();
    await openMenu();
    await userEvent.click(await screen.findByRole('menuitem', { name: /as PDF/i }));
    expect(await screen.findByText('Export failed')).toBeInTheDocument();
    expect(screen.getByText('Resume not found')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^download resume$/i })).toBeEnabled(),
    );
  });
});
