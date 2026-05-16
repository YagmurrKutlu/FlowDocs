import { IS_CODE, type LexicalEditor } from 'lexical';

function devCodeDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only inline code format tracing
    console.log('[code-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only inline code format tracing
    console.log('[code-debug]', message);
  }
}

function walkSerializedNodeHasCode(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;

  const candidate = node as { type?: unknown; format?: unknown; children?: unknown };
  if (candidate.type === 'text' && typeof candidate.format === 'number') {
    return (candidate.format & IS_CODE) !== 0;
  }

  if (!Array.isArray(candidate.children)) return false;
  return candidate.children.some((child) => walkSerializedNodeHasCode(child));
}

/** True when Lexical serialized JSON includes at least one text node with inline code format. */
export function serializedContainsCodeFormat(serialized: string | null | undefined): boolean {
  if (typeof serialized !== 'string' || serialized.length === 0) return false;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const root =
      typeof parsed === 'object' &&
      parsed !== null &&
      'root' in parsed &&
      typeof (parsed as { root?: unknown }).root === 'object'
        ? (parsed as { root: unknown }).root
        : parsed;
    return walkSerializedNodeHasCode(root);
  } catch {
    return false;
  }
}

export function editorStateContainsCodeFormat(editor: LexicalEditor): boolean {
  return serializedContainsCodeFormat(JSON.stringify(editor.getEditorState().toJSON()));
}

export function logCodeFormatApplied(): void {
  devCodeDebugLog('code format applied');
}

export function logSerializedContainsCode(serialized: string): void {
  if (serializedContainsCodeFormat(serialized)) {
    devCodeDebugLog('serialized contains code');
  }
}

export function logRestoredContainsCode(editor: LexicalEditor): void {
  if (editorStateContainsCodeFormat(editor)) {
    devCodeDebugLog('restored contains code');
  }
}
