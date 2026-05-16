import { $getSelectionStyleValueForProperty, $patchStyleText } from '@lexical/selection';
import {
  $getSelection,
  $isRangeSelection,
  $setSelection,
  HISTORY_MERGE_TAG,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';

/** Default toolbar preview when selection has no explicit color. */
export const DEFAULT_TEXT_COLOR = '#60a5fa';

export const ACTIVE_TEXT_COLOR_STORAGE_KEY = 'flowdocs.editor.activeTextColor';

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export const TEXT_COLOR_PALETTE = [
  '#000000',
  '#111827',
  '#1f2937',
  '#374151',
  '#4b5563',
  '#6b7280',
  '#ffffff',
  '#f8fafc',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#60a5fa',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#38bdf8',
  '#06b6d4',
  '#22c55e',
  '#16a34a',
  '#15803d',
  '#84cc16',
  '#65a30d',
  '#f59e0b',
  '#f97316',
  '#ea580c',
  '#ef4444',
  '#dc2626',
  '#b91c1c',
  '#a855f7',
  '#8b5cf6',
  '#7c3aed',
  '#6366f1',
  '#ec4899',
  '#f472b6',
  '#fb7185',
] as const;

export function normalizeTextColor(value: string | null | undefined): string {
  if (!value) return DEFAULT_TEXT_COLOR;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return DEFAULT_TEXT_COLOR;
  if (trimmed.startsWith('#')) return trimmed;
  return trimmed;
}

export function isAllowedActiveTextColor(value: string | null | undefined): boolean {
  const normalized = normalizeTextColor(value);
  if (!HEX_COLOR_RE.test(normalized)) return false;
  return TEXT_COLOR_PALETTE.some((paletteColor) => normalizeTextColor(paletteColor) === normalized);
}

export function readStoredActiveTextColor(): string {
  if (typeof window === 'undefined') return DEFAULT_TEXT_COLOR;
  try {
    const raw = window.localStorage.getItem(ACTIVE_TEXT_COLOR_STORAGE_KEY);
    if (!raw || !isAllowedActiveTextColor(raw)) return DEFAULT_TEXT_COLOR;
    return normalizeTextColor(raw);
  } catch {
    return DEFAULT_TEXT_COLOR;
  }
}

export function writeStoredActiveTextColor(color: string): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeTextColor(color);
    if (!isAllowedActiveTextColor(normalized)) return;
    window.localStorage.setItem(ACTIVE_TEXT_COLOR_STORAGE_KEY, normalized);
  } catch {
    // ignore quota / privacy errors
  }
}

export function applyTextColorToSelection(selection: RangeSelection, color: string): void {
  $patchStyleText(selection, { color });
}

export function readTextColorFromSelection(
  selection: RangeSelection,
  fallback = DEFAULT_TEXT_COLOR,
): string {
  return normalizeTextColor($getSelectionStyleValueForProperty(selection, 'color', fallback));
}

export function applyTextColorInEditor(
  editor: LexicalEditor,
  color: string,
  restoreSelection: RangeSelection | null,
): void {
  const normalized = normalizeTextColor(color);
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection) && restoreSelection) {
      $setSelection(restoreSelection.clone());
      selection = $getSelection();
    }
    if (!$isRangeSelection(selection)) return;
    applyTextColorToSelection(selection, normalized);
  });
}

function devRealtimeDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only collaborative sync tracing
    console.log('[realtime-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only collaborative sync tracing
    console.log('[realtime-debug]', message);
  }
}

/** Keeps collapsed caret insertion style aligned with toolbar active color (merged into history). */
export function applyActiveInsertionTextColor(editor: LexicalEditor, color: string): void {
  const normalized = normalizeTextColor(color);
  devRealtimeDebugLog('activeTextColor insertion patch (lexical update)', { color: normalized });
  editor.update(
    () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return;

      const raw = $getSelectionStyleValueForProperty(selection, 'color', '');
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) {
        $patchStyleText(selection, { color: normalized });
        return;
      }
      if (normalizeTextColor(trimmed) === normalized) return;

      $patchStyleText(selection, { color: normalized });
    },
    { tag: HISTORY_MERGE_TAG },
  );
}

export function insertionColorDiffersFromActive(
  selection: RangeSelection,
  activeColor: string,
): boolean {
  const raw = $getSelectionStyleValueForProperty(selection, 'color', '');
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return true;
  return normalizeTextColor(trimmed) !== normalizeTextColor(activeColor);
}
