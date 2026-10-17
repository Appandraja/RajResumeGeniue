import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeFile = vi.fn();
const share = vi.fn();
const apiGet = vi.fn();

vi.mock('../lib/platform', () => ({ isNativeApp: () => true }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...args: unknown[]) => writeFile(...args) },
  Directory: { Cache: 'CACHE' },
}));
vi.mock('@capacitor/share', () => ({
  Share: { share: (...args: unknown[]) => share(...args) },
}));
vi.mock('./api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }));

import { downloadResume } from './exportService';

function pdfResponse(disposition = 'attachment; filename="My Resume (v2).pdf"') {
  return {
    data: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }),
    headers: { 'content-disposition': disposition },
  };
}

describe('downloadResume on the Android app', () => {
  beforeEach(() => {
    writeFile.mockResolvedValue({ uri: 'file:///cache/My_Resume__v2_.pdf' });
    share.mockResolvedValue({ activityType: 'x' });
    apiGet.mockResolvedValue(pdfResponse());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes the file to the cache and opens the share sheet', async () => {
    await downloadResume(7, 'pdf');

    expect(apiGet).toHaveBeenCalledWith('/api/resumes/7/export/pdf', { responseType: 'blob' });
    const written = writeFile.mock.calls[0][0] as { path: string; data: string; directory: string };
    expect(written.directory).toBe('CACHE');
    expect(written.path).toMatch(/^[A-Za-z0-9._-]+\.pdf$/); // path-safe local name
    expect(atob(written.data)).toBe('%PDF-1.4 test'); // base64 payload, no data: prefix
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'file:///cache/My_Resume__v2_.pdf' }),
    );
  });

  it('does not treat a dismissed share sheet as a failure', async () => {
    share.mockRejectedValue(new Error('Share canceled'));
    await expect(downloadResume(7, 'pdf')).resolves.toBeUndefined();
  });

  it('surfaces other share failures with a friendly message', async () => {
    share.mockRejectedValue(new Error('boom'));
    await expect(downloadResume(7, 'pdf')).rejects.toThrow(/could not export/i);
  });

  it('surfaces file-system failures with a friendly message', async () => {
    writeFile.mockRejectedValue(new Error('disk full'));
    await expect(downloadResume(7, 'docx')).rejects.toThrow(/could not export/i);
  });
});
