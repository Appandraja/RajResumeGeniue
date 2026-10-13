export type ExportFormat = 'pdf' | 'docx' | 'odt' | 'rtf' | 'txt' | 'md' | 'html';

export interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  extension: string;
  mime: string;
  description: string;
}

export const EXPORT_FORMATS: readonly ExportFormatInfo[] = [
  {
    id: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    mime: 'application/pdf',
    description: 'Recommended for most applications. Looks the same everywhere.',
  },
  {
    id: 'docx',
    label: 'Word (.docx)',
    extension: 'docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Editable in Microsoft Word, Google Docs and most editors.',
  },
  {
    id: 'odt',
    label: 'OpenDocument (.odt)',
    extension: 'odt',
    mime: 'application/vnd.oasis.opendocument.text',
    description: 'For LibreOffice and other open-source word processors.',
  },
  {
    id: 'rtf',
    label: 'Rich Text (.rtf)',
    extension: 'rtf',
    mime: 'application/rtf',
    description: 'Simple formatted text that nearly any program can open.',
  },
  {
    id: 'txt',
    label: 'Plain text (.txt)',
    extension: 'txt',
    mime: 'text/plain',
    description: 'Safest for ATS text boxes and online forms. No formatting.',
  },
  {
    id: 'md',
    label: 'Markdown (.md)',
    extension: 'md',
    mime: 'text/markdown',
    description: 'Lightweight text with simple headings, for developers and notes.',
  },
  {
    id: 'html',
    label: 'HTML (.html)',
    extension: 'html',
    mime: 'text/html',
    description: 'A web page you can open in a browser or publish online.',
  },
];

export function getExportFormat(id: ExportFormat): ExportFormatInfo {
  const found = EXPORT_FORMATS.find((f) => f.id === id);
  if (!found) throw new Error(`Unknown export format: ${id}`);
  return found;
}
