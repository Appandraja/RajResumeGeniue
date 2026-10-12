import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isAxiosError } from 'axios';
import { isNativeApp } from '../lib/platform';
import api from './api';

export type ExportFormat = 'pdf' | 'docx';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

const FALLBACK_FILENAMES: Record<ExportFormat, string> = {
  pdf: 'resume.pdf',
  docx: 'resume.docx',
};

function filenameFromDisposition(header: string | undefined, format: ExportFormat): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? FALLBACK_FILENAMES[format];
}

/** Error responses arrive as a Blob when responseType is 'blob'; unwrap the message. */
async function messageFromError(err: unknown, format: ExportFormat): Promise<string> {
  const label = format.toUpperCase();
  if (isAxiosError(err) && err.response) {
    if (err.response.status === 501) {
      return `${label} export is not available yet.`;
    }
    const data: unknown = err.response.data;
    if (data instanceof Blob) {
      try {
        const body = JSON.parse(await data.text()) as ApiErrorBody;
        if (body.error?.message) {
          return body.error.message;
        }
      } catch {
        // fall through to the generic message
      }
    }
  }
  return `Could not export your resume as ${label}. Please try again.`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read the file.'));
        return;
      }
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Android WebViews cannot save a blob through an <a download> link, so the app writes the
 * file to its cache and opens the system share sheet (Save to Drive / Files, email, ...).
 */
async function saveAndShare(blob: Blob, filename: string): Promise<void> {
  const localName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  const written = await Filesystem.writeFile({
    path: localName,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  try {
    await Share.share({
      title: localName,
      dialogTitle: 'Save or share your resume',
      url: written.uri,
    });
  } catch (err) {
    // Dismissing the share sheet is not an error.
    if (!(err instanceof Error && /cancel/i.test(err.message))) {
      throw err;
    }
  }
}

function saveInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Download a resume as a file. Throws an Error with a user-facing message. */
export async function downloadResume(resumeId: number, format: ExportFormat): Promise<void> {
  try {
    const response = await api.get<Blob>(`/api/resumes/${resumeId}/export/${format}`, {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = filenameFromDisposition(disposition, format);

    if (isNativeApp()) {
      await saveAndShare(response.data, filename);
    } else {
      saveInBrowser(response.data, filename);
    }
  } catch (err) {
    throw new Error(await messageFromError(err, format), { cause: err });
  }
}
