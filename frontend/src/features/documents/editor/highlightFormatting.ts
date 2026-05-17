import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import { $isCodeNode } from '@lexical/code';
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';

export const DEFAULT_HIGHLIGHT_COLOR = '#fef08a';
export const ACTIVE_HIGHLIGHT_STORAGE_KEY = 'flowdocs.editor.activeHighlightColor';

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HIGHLIGHT_STYLE_KEY = 'background-color';

export const HIGHLIGHT_PALETTE = [
  { id: 'clear', label: 'Yok / temizle', value: null },
  { id: 'yellow-1', label: 'Sarı', value: '#fef08a' },
  { id: 'yellow-2', label: 'Sarı koyu', value: '#fde68a' },
  { id: 'green-1', label: 'Yeşil', value: '#bbf7d0' },
  { id: 'green-2', label: 'Yeşil koyu', value: '#86efac' },
  { id: 'blue-1', label: 'Mavi', value: '#bfdbfe' },
  { id: 'blue-2', label: 'Mavi koyu', value: '#93c5fd' },
  { id: 'pink-1', label: 'Pembe', value: '#fbcfe8' },
  { id: 'pink-2', label: 'Pembe koyu', value: '#f9a8d4' },
  { id: 'purple-1', label: 'Mor', value: '#e9d5ff' },
  { id: 'purple-2', label: 'Mor koyu', value: '#d8b4fe' },
  { id: 'orange-1', label: 'Turuncu', value: '#fed7aa' },
  { id: 'orange-2', label: 'Turuncu koyu', value: '#fdba74' },
  { id: 'gray-1', label: 'Gri', value: '#e2e8f0' },
  { id: 'gray-2', label: 'Gri koyu', value: '#cbd5e1' },
] as const;

export type HighlightPaletteColor = (typeof HIGHLIGHT_PALETTE)[number]['value'];

function devHighlightDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only highlight tracing
    console.log('[highlight-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only highlight tracing
    console.log('[highlight-debug]', message);
  }
}

export function normalizeHighlightColor(value: string | null | undefined): string {
  if (!value) return DEFAULT_HIGHLIGHT_COLOR;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return DEFAULT_HIGHLIGHT_COLOR;
  if (trimmed.startsWith('#')) return trimmed;
  return trimmed;
}

export function isAllowedActiveHighlightColor(value: string | null | undefined): boolean {
  const normalized = normalizeHighlightColor(value);
  if (!HEX_COLOR_RE.test(normalized)) return false;
  return HIGHLIGHT_PALETTE.some(
    (entry) => entry.value !== null && normalizeHighlightColor(entry.value) === normalized,
  );
}

export function readStoredActiveHighlightColor(): string {
  if (typeof window === 'undefined') return DEFAULT_HIGHLIGHT_COLOR;
  try {
    const raw = window.localStorage.getItem(ACTIVE_HIGHLIGHT_STORAGE_KEY);
    if (!raw || !isAllowedActiveHighlightColor(raw)) return DEFAULT_HIGHLIGHT_COLOR;
    return normalizeHighlightColor(raw);
  } catch {
    return DEFAULT_HIGHLIGHT_COLOR;
  }
}

export function writeStoredActiveHighlightColor(color: string): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeHighlightColor(color);
    if (!isAllowedActiveHighlightColor(normalized)) return;
    window.localStorage.setItem(ACTIVE_HIGHLIGHT_STORAGE_KEY, normalized);
  } catch {
    // ignore quota / privacy errors
  }
}

export function selectionIsInsideCodeBlock(selection: RangeSelection): boolean {
  const topLevel = selection.anchor.getNode().getTopLevelElement();
  return topLevel !== null && $isCodeNode(topLevel);
}

export function applyHighlightToSelection(selection: RangeSelection, color: string): void {
  const normalized = normalizeHighlightColor(color);
  $patchStyleText(selection, { [HIGHLIGHT_STYLE_KEY]: normalized });
  devHighlightDebugLog('highlight applied', { color: normalized });
}

export function clearHighlightFromSelection(selection: RangeSelection): void {
  $patchStyleText(selection, { [HIGHLIGHT_STYLE_KEY]: null });
  devHighlightDebugLog('highlight cleared');
}

export function readHighlightFromSelection(selection: RangeSelection): string | null {
  const raw = $getSelectionStyleValueForProperty(selection, HIGHLIGHT_STYLE_KEY, '').trim();
  if (!raw) return null;
  const normalized = normalizeHighlightColor(raw);
  if (!isAllowedActiveHighlightColor(normalized)) return normalized;
  return normalized;
}

export function applyHighlightInEditor(
  editor: LexicalEditor,
  color: string,
  restoreSelection: RangeSelection | null,
): boolean {
  const normalized = normalizeHighlightColor(color);
  let applied = false;
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection) && restoreSelection) {
      $setSelection(restoreSelection.clone());
      selection = $getSelection();
    }
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
    if (selectionIsInsideCodeBlock(selection)) return;
    applyHighlightToSelection(selection, normalized);
    applied = true;
  });
  return applied;
}

export function clearHighlightInEditor(
  editor: LexicalEditor,
  restoreSelection: RangeSelection | null,
): boolean {
  let cleared = false;
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection) && restoreSelection) {
      $setSelection(restoreSelection.clone());
      selection = $getSelection();
    }
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
    if (selectionIsInsideCodeBlock(selection)) return;
    clearHighlightFromSelection(selection);
    cleared = true;
  });
  return cleared;
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

export function serializedContainsHighlight(serialized: string | null | undefined): boolean {
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
      if (node.type !== 'text') return;
      const style = node.style;
      if (typeof style === 'string' && style.includes('background-color')) {
        found = true;
      }
    });
    return found;
  } catch {
    return false;
  }
}

export function editorStateContainsHighlight(editor: LexicalEditor): boolean {
  return serializedContainsHighlight(JSON.stringify(editor.getEditorState().toJSON()));
}

export function logSerializedContainsHighlight(serialized: string): void {
  if (serializedContainsHighlight(serialized)) {
    devHighlightDebugLog('serialized contains highlight');
  }
}

export function logRestoredContainsHighlight(editor: LexicalEditor): void {
  if (editorStateContainsHighlight(editor)) {
    devHighlightDebugLog('restored contains highlight');
  }
}
