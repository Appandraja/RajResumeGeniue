import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportResult } from '../types/importer';
import api from './api';
import { IMPORT_ACCEPT, importResume, validateImportFile } from './importService';

vi.mock('./api', () => ({
  default: { post: vi.fn() },
}));

const post = vi.mocked(api.post);

function file(name: string, size = 100): File {
  const f = new File(['x'], name, { type: 'application/octet-stream' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function httpError(status: number, data: unknown): AxiosError {
  const response: AxiosResponse = {
    data,
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
  return new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, response);
}

const result: ImportResult = {
  draft: {
    title: 'Imported',
    full_name: 'Ada',
    email: null,
    phone: null,
    location: null,
    linkedin_url: null,
    website_url: null,
    summary: null,
    skills: [],
    sections: [],
  },
  warnings: [],
  source_format: 'pdf',
  char_count: 10,
};

describe('validateImportFile', () => {
  it('accepts supported extensions case-insensitively', () => {
    for (const name of ['a.pdf', 'a.DOCX', 'a.odt', 'a.rtf', 'a.txt', 'a.md', 'a.markdown', 'a.html', 'a.htm']) {
      expect(validateImportFile(file(name))).toBeNull();
    }
  });
  it('rejects unsupported types', () => {
    expect(validateImportFile(file('a.exe'))).toMatch(/not supported/i);
    expect(validateImportFile(file('noext'))).toMatch(/not supported/i);
  });
  it('tells the user to save .doc as .docx', () => {
    expect(validateImportFile(file('old.doc'))).toMatch(/save it as \.docx/i);
  });
  it('rejects empty and oversized files', () => {
    expect(validateImportFile(file('a.pdf', 0))).toMatch(/empty/i);
    expect(validateImportFile(file('a.pdf', 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
    expect(validateImportFile(file('a.pdf', 5 * 1024 * 1024))).toBeNull();
  });
  it('exposes an accept string', () => {
    expect(IMPORT_ACCEPT).toContain('.pdf');
  });
});

describe('importResume', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('posts multipart form data without a manual content type', async () => {
    post.mockResolvedValue({ data: result });
    const out = await importResume(file('cv.pdf'));
    expect(out).toEqual(result);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/api/import/resume');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBeInstanceOf(File);
    expect(config).toBeUndefined();
  });

  it.each([
    [413, {}, /5 MB/],
    [415, {}, /not supported/i],
    [429, {}, /too quickly/i],
    [400, { error: { message: 'This PDF looks scanned.' } }, /looks scanned/],
    [400, {}, /could not read/i],
    [500, {}, /try again/i],
  ])('maps HTTP %i', async (status, body, expected) => {
    post.mockRejectedValue(httpError(status, body));
    await expect(importResume(file('cv.pdf'))).rejects.toThrow(expected);
  });

  it('suggests .docx for a rejected .doc', async () => {
    post.mockRejectedValue(httpError(415, {}));
    await expect(importResume(file('cv.doc'))).rejects.toThrow(/save it as \.docx/i);
  });

  it('maps network errors', async () => {
    post.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    await expect(importResume(file('cv.pdf'))).rejects.toThrow(/reach the server/i);
  });
});
