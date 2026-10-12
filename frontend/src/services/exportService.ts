import { isAxiosError } from 'axios';
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

/** Download a resume as a file in the browser. Throws an Error with a user-facing message. */
export async function downloadResume(resumeId: number, format: ExportFormat): Promise<void> {
  try {
    const response = await api.get<Blob>(`/api/resumes/${resumeId}/export/${format}`, {
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] as string | undefined;
    const filename = filenameFromDisposition(disposition, format);

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    throw new Error(await messageFromError(err, format), { cause: err });
  }
}
