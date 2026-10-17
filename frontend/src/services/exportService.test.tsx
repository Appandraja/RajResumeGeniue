import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from './api';
import { downloadResume } from './exportService';

vi.mock('./api', () => ({
  default: { get: vi.fn() },
}));

function okResponse(disposition?: string): AxiosResponse<Blob> {
  const headers: Record<string, string> = {};
  if (disposition) headers['content-disposition'] = disposition;
  return {
    data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    status: 200,
    statusText: 'OK',
    headers,
    config: { headers: new AxiosHeaders() },
  };
}

function errorResponse(status: number, body: string): AxiosError {
  const response: AxiosResponse<Blob> = {
    data: new Blob([body], { type: 'application/json' }),
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
}

describe('downloadResume', () => {
  let clicked: HTMLAnchorElement[];
  const createObjectURL = vi.fn(() => 'blob:mock');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    clicked = [];
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the blob endpoint and uses the server filename', async () => {
    vi.mocked(api.get).mockResolvedValue(okResponse('attachment; filename="Jane_Doe.pdf"'));
    await downloadResume(12, 'pdf');
    expect(api.get).toHaveBeenCalledWith('/api/resumes/12/export/pdf', { responseType: 'blob' });
    expect(clicked).toHaveLength(1);
    expect(clicked[0]?.download).toBe('Jane_Doe.pdf');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('parses unquoted filenames', async () => {
    vi.mocked(api.get).mockResolvedValue(okResponse('attachment; filename=cv.docx'));
    await downloadResume(1, 'docx');
    expect(clicked[0]?.download).toBe('cv.docx');
  });

  it.each(['pdf', 'docx', 'odt', 'rtf', 'txt', 'md', 'html'] as const)(
    'requests /export/%s and falls back to resume.%s without a header',
    async (format) => {
      vi.mocked(api.get).mockResolvedValue(okResponse());
      await downloadResume(3, format);
      expect(api.get).toHaveBeenCalledWith(`/api/resumes/3/export/${format}`, {
        responseType: 'blob',
      });
      expect(clicked[0]?.download).toBe(`resume.${format}`);
    },
  );

  it('keeps the server message for a PDF 400 and suggests another format', async () => {
    const body = JSON.stringify({
      error: { code: 'BAD_REQUEST', message: 'Some characters are not supported in PDF.' },
    });
    vi.mocked(api.get).mockRejectedValue(errorResponse(400, body));
    await expect(downloadResume(1, 'pdf')).rejects.toThrow(
      /Some characters are not supported in PDF\..*another format/,
    );
  });

  it('maps 501 to a not-available message', async () => {
    vi.mocked(api.get).mockRejectedValue(errorResponse(501, '{}'));
    await expect(downloadResume(1, 'docx')).rejects.toThrow('DOCX export is not available yet.');
  });

  it('surfaces the API error message from a blob body', async () => {
    const body = JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Resume not found' } });
    vi.mocked(api.get).mockRejectedValue(errorResponse(404, body));
    await expect(downloadResume(1, 'pdf')).rejects.toThrow('Resume not found');
  });

  it('uses a generic message when the error body is not JSON', async () => {
    vi.mocked(api.get).mockRejectedValue(errorResponse(500, 'Internal Server Error'));
    await expect(downloadResume(1, 'pdf')).rejects.toThrow(
      'Could not export your resume as PDF. Please try again.',
    );
  });

  it('uses a generic message for network errors', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Network Error'));
    await expect(downloadResume(1, 'docx')).rejects.toThrow(
      'Could not export your resume as DOCX. Please try again.',
    );
    expect(clicked).toHaveLength(0);
  });
});
