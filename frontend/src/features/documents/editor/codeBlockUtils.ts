import { $isCodeNode } from '@lexical/code';
import { $getRoot, $isElementNode, type LexicalEditor, type LexicalNode } from 'lexical';

let lastCodeBlockDebugLogAt = 0;

function devCodeBlockDebugLog(
  message: string,
  data?: Record<string, unknown>,
  options?: { force?: boolean },
): void {
  if (!import.meta.env.DEV) return;
  const now = Date.now();
  if (!options?.force && now - lastCodeBlockDebugLogAt < 3000) {
    return;
  }
  lastCodeBlockDebugLogAt = now;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only code block persistence tracing
    console.log('[codeblock-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only code block persistence tracing
    console.log('[codeblock-debug]', message);
  }
}

function extractTextFromSerializedNode(node: unknown): string {
  if (!node || typeof node !== 'object') return '';

  const candidate = node as { type?: unknown; text?: unknown; children?: unknown };
  if (candidate.type === 'code-highlight' && typeof candidate.text === 'string') {
    return candidate.text;
  }
  if (candidate.type === 'text' && typeof candidate.text === 'string') {
    return candidate.text;
  }
  if (candidate.type === 'linebreak') {
    return '\n';
  }

  if (!Array.isArray(candidate.children)) return '';
  return candidate.children.map((child) => extractTextFromSerializedNode(child)).join('');
}

function walkSerializedNode(node: unknown, onNode: (node: Record<string, unknown>) => void): void {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  onNode(record);
  const children = record.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      walkSerializedNode(child, onNode);
    }
  }
}

function normalizeCodeBlockChildrenInSerialized(node: Record<string, unknown>): void {
  if (node.type !== 'code' || !Array.isArray(node.children)) return;

  node.children = node.children.map((child) => {
    if (!child || typeof child !== 'object') return child;
    const record = child as Record<string, unknown>;
    if (record.type === 'text' && typeof record.text === 'string') {
      return {
        ...record,
        type: 'code-highlight',
        highlightType: record.highlightType ?? null,
        version: typeof record.version === 'number' ? record.version : 1,
      };
    }
    return child;
  });
}

/**
 * Converts plain `text` children under `code` nodes to `code-highlight` in serialized JSON only.
 * Does not touch the live editor — safe to call before Yjs/API persist and before restore apply.
 */
export function normalizeSerializedCodeBlocks(serialized: string): string {
  if (!serialized.trim()) return serialized;
  try {
    const parsed = JSON.parse(serialized) as { root?: unknown };
    const root =
      typeof parsed === 'object' &&
      parsed !== null &&
      'root' in parsed &&
      typeof parsed.root === 'object'
        ? parsed.root
        : parsed;
    walkSerializedNode(root, normalizeCodeBlockChildrenInSerialized);
    return JSON.stringify(parsed);
  } catch {
    return serialized;
  }
}

/** True when Lexical serialized JSON includes at least one CodeNode block. */
export function serializedContainsCodeBlock(serialized: string | null | undefined): boolean {
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
    let found = false;
    walkSerializedNode(root, (node) => {
      if (node.type === 'code') {
        found = true;
      }
    });
    return found;
  } catch {
    return false;
  }
}

/** Total text length inside serialized CodeNode blocks (code-highlight + text children). */
export function getCodeBlockTextLengthFromSerialized(
  serialized: string | null | undefined,
): number {
  if (typeof serialized !== 'string' || serialized.length === 0) return 0;
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const root =
      typeof parsed === 'object' &&
      parsed !== null &&
      'root' in parsed &&
      typeof (parsed as { root?: unknown }).root === 'object'
        ? (parsed as { root: unknown }).root
        : parsed;
    let total = 0;
    walkSerializedNode(root, (node) => {
      if (node.type === 'code') {
        total += extractTextFromSerializedNode(node).length;
      }
    });
    return total;
  } catch {
    return 0;
  }
}

export function getCodeBlockTextLengthFromEditor(editor: LexicalEditor): number {
  return editor.getEditorState().read(() => {
    let total = 0;
    const visit = (node: LexicalNode) => {
      if ($isCodeNode(node)) {
        total += node.getTextContent().length;
      }
      if ($isElementNode(node)) {
        for (const child of node.getChildren()) {
          visit(child);
        }
      }
    };
    for (const child of $getRoot().getChildren()) {
      visit(child);
    }
    return total;
  });
}

export function editorStateContainsCodeBlock(editor: LexicalEditor): boolean {
  return serializedContainsCodeBlock(JSON.stringify(editor.getEditorState().toJSON()));
}

export function logSerializedContainsCodeBlock(
  serialized: string,
  options?: { force?: boolean },
): void {
  if (serializedContainsCodeBlock(serialized)) {
    devCodeBlockDebugLog(
      'serialized contains code block',
      { textLength: getCodeBlockTextLengthFromSerialized(serialized) },
      options,
    );
  }
}

export function logCodeBlockTextLength(label: string, length: number): void {
  devCodeBlockDebugLog('code block text length', { label, length }, { force: true });
}

export function logRestoredCodeBlockTextLength(editor: LexicalEditor): void {
  const length = getCodeBlockTextLengthFromEditor(editor);
  if (length > 0 || editorStateContainsCodeBlock(editor)) {
    devCodeBlockDebugLog('restored code block text length', { length }, { force: true });
  }
}

export function logCodeBlockFallbackBecauseMissing(): void {
  devCodeBlockDebugLog('fallback editorStateJson because code block text missing', undefined, {
    force: true,
  });
}
