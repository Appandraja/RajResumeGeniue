import { isAxiosError } from 'axios';
import type { ImportResult } from '../types/importer';
import api from './api';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_IMPORT_EXTENSIONS: readonly string[] = [
  '.pdf',
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
  '.md',
  '.markdown',
  '.html',
  '.htm',
];

/** Value for the file input's `accept` attribute. */
export const IMPORT_ACCEPT: string = SUPPORTED_IMPORT_EXTENSIONS.join(',');

/** Short labels for display. */
export const SUPPORTED_IMPORT_FORMATS: readonly string[] = [
  'PDF',
  'DOCX',
  'ODT',
  'RTF',
  'TXT',
  'MD',
  'HTML',
];

const SUPPORTED_TEXT = 'PDF, DOCX, ODT, RTF, TXT, MD or HTML';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
  detail?: unknown;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

/** Client-side pre-check. Returns a user-facing message, or null when the file looks fine. */
export function validateImportFile(file: File): string | null {
  const ext = extensionOf(file.name);
  if (ext === '.doc') {
    return 'Old .doc files are not supported. Please save it as .docx first, then try again.';
  }
  if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext)) {
    return `This file type is not supported. Please choose a ${SUPPORTED_TEXT} file.`;
  }
  if (file.size === 0) {
    return 'This file is empty. Please choose a different file.';
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return 'This file is too large. The limit is 5 MB.';
  }
  return null;
}

function serverMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const body = data as ApiErrorBody;
  if (typeof body.error?.message === 'string' && body.error.message) return body.error.message;
  if (typeof body.detail === 'string' && body.detail) return body.detail;
  return null;
}

function messageFromError(err: unknown, file: File): string {
  if (isAxiosError(err)) {
    if (!err.response) {
      return 'Could not reach the server. Check your internet connection and try again.';
    }
    const { status, data } = err.response;
    switch (status) {
      case 413:
        return 'This file is too large. The limit is 5 MB.';
      case 415:
        return extensionOf(file.name) === '.doc'
          ? 'Old .doc files are not supported. Please save it as .docx first, then try again.'
          : `This file type is not supported. Please use a ${SUPPORTED_TEXT} file.`;
      case 400:
        return (
          serverMessage(data) ??
          'We could not read any text from this file. Please try a different file.'
        );
      case 429:
        return 'You are importing too quickly. Please wait a minute and try again.';
      default:
        break;
    }
  }
  return 'Could not import your resume. Please try again.';
}

/** Upload a resume file and get back a parsed draft. Throws an Error with a user-facing message. */
export async function importResume(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file);
  try {
    // No manual Content-Type: axios must add the multipart boundary itself.
    const { data } = await api.post<ImportResult>('/api/import/resume', form);
    return data;
  } catch (err) {
    throw new Error(messageFromError(err, file), { cause: err });
  }
}
