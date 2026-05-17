export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
] as const;

export type AllowedDocumentMimeType = (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

const MIME_ACCEPT = ALLOWED_DOCUMENT_MIME_TYPES.join(',');

export const DOCUMENT_FILE_INPUT_ACCEPT = `${MIME_ACCEPT},.pdf,.doc,.docx,.txt,.csv`;

export function isAllowedDocumentMimeType(mimeType: string): mimeType is AllowedDocumentMimeType {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateDocumentUploadFile(file: File): { ok: true } | { ok: false; message: string } {
  if (!isAllowedDocumentMimeType(file.type)) {
    return {
      ok: false,
      message: 'Desteklenen türler: PDF, DOC, DOCX, TXT ve CSV.',
    };
  }
  if (file.size <= 0 || file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return {
      ok: false,
      message: 'Dosya boyutu en fazla 20 MB olabilir.',
    };
  }
  return { ok: true };
}

export function sanitizeFileDisplayName(fileName: string): string {
  const trimmed = fileName.trim().replace(/[/\\<>:"|?*\u0000-\u001f]/g, '_');
  if (!trimmed) return 'dosya';
  return trimmed.slice(0, 200);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;
}

export function getFileTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'DOCX';
    case 'application/msword':
      return 'DOC';
    case 'text/plain':
      return 'TXT';
    case 'text/csv':
      return 'CSV';
    default:
      return 'Dosya';
  }
}

function devFileAttachmentDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only file attachment tracing
    console.log('[file-attachment-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only file attachment tracing
    console.log('[file-attachment-debug]', message);
  }
}

export function logFileAttachmentInserted(fileName: string, mimeType: string): void {
  devFileAttachmentDebugLog('file attachment inserted', { fileName, mimeType });
}

export function logSerializedContainsFileAttachment(serialized: string): void {
  if (!serialized.includes('"type":"file-attachment"') && !serialized.includes('"type": "file-attachment"')) {
    return;
  }
  devFileAttachmentDebugLog('serialized contains file attachment');
}

function devFileDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only file block tracing
    console.log('[file-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only file block tracing
    console.log('[file-debug]', message);
  }
}

export function logFileAttachmentSelected(nodeKey: string): void {
  devFileDebugLog('attachment selected', { nodeKey });
}

export function logMoveAttachment(
  direction: 'up' | 'down',
  success: boolean,
): void {
  devFileDebugLog('move attachment', { direction, success });
}

export function logAlignAttachment(align: string): void {
  devFileDebugLog('align attachment', { align });
}

export function logResizeAttachment(widthPreset: string): void {
  devFileDebugLog('resize attachment', { widthPreset });
}

export function logToolbarActiveKey(data: {
  activeKey: string | null;
  selectionKey: string | null;
  canEdit: boolean;
}): void {
  devFileDebugLog('toolbar active key', data);
}

export function logToolbarDisabledState(data: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  canEdit: boolean;
  hasNode: boolean;
}): void {
  devFileDebugLog('toolbar disabled state', data);
}

export function logFileAttachmentSelectionPersisted(nodeKey: string): void {
  devFileDebugLog('attachment selection persisted', { nodeKey });
}

export function logKeepToolbarBecauseAttachment(): void {
  devFileDebugLog('keep toolbar because target is attachment');
}

export function logKeepToolbarBecauseAttachmentToolbar(): void {
  devFileDebugLog('keep toolbar because target is attachment toolbar');
}

export function logOutsidePointerdownCloseToolbar(): void {
  devFileDebugLog('outside pointerdown close toolbar');
}

export function logActiveAttachmentKeyCleared(): void {
  devFileDebugLog('activeAttachmentKey cleared');
}

export function logToolbarButtonClicked(action: string): void {
  devFileDebugLog('toolbar button clicked', { action });
}

/** First line in every toolbar handler — proves click reached React. */
export function logToolbarClick(action: string): void {
  devFileDebugLog(`CLICK ${action}`);
}

export function logToolbarActionDiagnostics(data: Record<string, unknown>): void {
  devFileDebugLog('toolbar action diagnostics', data);
}

export function logActionBlocked(keys: Record<string, unknown>): void {
  devFileDebugLog('action blocked: attachment node not found', keys);
}
