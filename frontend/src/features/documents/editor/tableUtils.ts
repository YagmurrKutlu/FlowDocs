import {
  $createTableSelectionFrom,
  $findTableNode,
  $getTableCellNodeFromLexicalNode,
  $isTableCellNode,
  $isTableRowNode,
  $isTableSelection,
} from '@lexical/table';
import type { LexicalEditor } from 'lexical';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $setSelection,
} from 'lexical';
import {
  $isFlowDocsTableNode,
  type FlowDocsTableNode,
} from './nodes/FlowDocsTableNode';

export type TableMoveDirection = 'up' | 'down';

const MIN_TABLE_SIZE = 2;
const MAX_TABLE_SIZE = 6;
const DEFAULT_TABLE_SIZE = 3;

function devTableDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only table tracing
    console.log('[table-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only table tracing
    console.log('[table-debug]', message);
  }
}

export function clampTableDimension(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TABLE_SIZE;
  return Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, Math.round(value)));
}

export { MIN_TABLE_SIZE, MAX_TABLE_SIZE, DEFAULT_TABLE_SIZE };

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

export function serializedContainsTable(serialized: string | null | undefined): boolean {
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
      if (node.type === 'table') {
        found = true;
      }
    });
    return found;
  } catch {
    return false;
  }
}

export function editorStateContainsTable(editor: LexicalEditor): boolean {
  return serializedContainsTable(JSON.stringify(editor.getEditorState().toJSON()));
}

export function logInsertTable(rows: number, columns: number): void {
  devTableDebugLog('insert table', { rows, columns });
}

export function logSerializedContainsTable(serialized: string): void {
  if (serializedContainsTable(serialized)) {
    devTableDebugLog('serialized contains table');
  }
}

export function logRestoredContainsTable(editor: LexicalEditor): void {
  if (editorStateContainsTable(editor)) {
    devTableDebugLog('restored contains table');
  }
}

export function serializedTableLayoutSummary(
  serialized: string | null | undefined,
): { count: number; layouts: Array<{ layoutAlign?: string; widthPreset?: string }> } {
  const layouts: Array<{ layoutAlign?: string; widthPreset?: string }> = [];
  if (typeof serialized !== 'string' || serialized.length === 0) {
    return { count: 0, layouts };
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const root =
      typeof parsed === 'object' &&
      parsed !== null &&
      'root' in parsed &&
      typeof (parsed as { root?: unknown }).root === 'object'
        ? (parsed as { root: unknown }).root
        : parsed;
    walkSerializedNode(root, (node) => {
      if (node.type === 'table') {
        layouts.push({
          layoutAlign:
            typeof node.layoutAlign === 'string' ? node.layoutAlign : undefined,
          widthPreset: typeof node.widthPreset === 'string' ? node.widthPreset : undefined,
        });
      }
    });
  } catch {
    return { count: 0, layouts };
  }
  return { count: layouts.length, layouts };
}

export function logSerializedTableLayout(serialized: string): void {
  const summary = serializedTableLayoutSummary(serialized);
  if (summary.count > 0) {
    devTableDebugLog('serialized table layout', summary);
  }
}

export function logMoveTable(direction: TableMoveDirection): void {
  devTableDebugLog('move table', { direction });
}

export function $canMoveFlowDocsTable(
  table: FlowDocsTableNode,
  direction: TableMoveDirection,
): boolean {
  return direction === 'up'
    ? table.getPreviousSibling() !== null
    : table.getNextSibling() !== null;
}

function $captureTableSelectionCellKeys(
  table: FlowDocsTableNode,
): { anchorCellKey: string; focusCellKey: string } | null {
  const selection = $getSelection();
  if ($isTableSelection(selection) && selection.tableKey === table.getKey()) {
    return {
      anchorCellKey: selection.anchor.key,
      focusCellKey: selection.focus.key,
    };
  }
  if ($isRangeSelection(selection)) {
    const anchorCell = $getTableCellNodeFromLexicalNode(selection.anchor.getNode());
    if (!anchorCell) return null;
    const focusCell = selection.isCollapsed()
      ? anchorCell
      : $getTableCellNodeFromLexicalNode(selection.focus.getNode());
    if (!focusCell) return null;
    const tableFromCell = $findTableNode(anchorCell);
    if (!$isFlowDocsTableNode(tableFromCell) || !tableFromCell.is(table)) {
      return null;
    }
    return {
      anchorCellKey: anchorCell.getKey(),
      focusCellKey: focusCell.getKey(),
    };
  }
  return null;
}

function $restoreTableSelection(
  table: FlowDocsTableNode,
  cellKeys: { anchorCellKey: string; focusCellKey: string } | null,
): void {
  if (cellKeys) {
    const anchorCell = $getNodeByKey(cellKeys.anchorCellKey);
    const focusCell = $getNodeByKey(cellKeys.focusCellKey);
    if ($isTableCellNode(anchorCell) && $isTableCellNode(focusCell)) {
      $setSelection($createTableSelectionFrom(table, anchorCell, focusCell));
      return;
    }
  }

  const firstRow = table.getFirstChild();
  if (!$isTableRowNode(firstRow)) return;
  const firstCell = firstRow.getFirstChild();
  if ($isTableCellNode(firstCell)) {
    $setSelection($createTableSelectionFrom(table, firstCell, firstCell));
  }
}

export function $moveFlowDocsTable(
  table: FlowDocsTableNode,
  direction: TableMoveDirection,
): boolean {
  const sibling =
    direction === 'up' ? table.getPreviousSibling() : table.getNextSibling();
  if (!sibling) return false;

  const cellKeys = $captureTableSelectionCellKeys(table);

  if (direction === 'up') {
    sibling.insertBefore(table);
  } else {
    sibling.insertAfter(table);
  }

  $restoreTableSelection(table, cellKeys);
  return true;
}
