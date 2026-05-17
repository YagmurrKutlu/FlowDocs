import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { InitialConfigType } from '@lexical/react/LexicalComposer';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Group,
  Indicator,
  ScrollArea,
  Popover,
  Select,
  Stack,
  Tabs,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconCode,
  IconCodeDots,
  IconDownload,
  IconHighlight,
  IconItalic,
  IconLetterA,
  IconList,
  IconListNumbers,
  IconPaperclip,
  IconPhotoPlus,
  IconStrikethrough,
  IconUnderline,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { $createCodeNode, $isCodeNode, CodeHighlightNode, CodeNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { TableCellNode, TableRowNode } from '@lexical/table';
import { $createHeadingNode, $isHeadingNode, HeadingNode } from '@lexical/rich-text';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $setBlocksType } from '@lexical/selection';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';
import { io, type Socket } from 'socket.io-client';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
} from 'react';
import * as Y from 'yjs';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { useAuthStore } from '../../../store/auth.store';
import {
  confirmDocumentMediaUpload,
  createDocumentMediaPresign,
  fetchDocumentState,
  postDocumentUpdate,
} from '../api/documents.api';
import { documentsQueryKeys } from '../hooks/useDocumentsQueries';
import {
  removeDocumentMessageFromCache,
  upsertDocumentMessageInCache,
} from '../utils/document-messages-cache';
import type { DocumentMessage } from '../types/document.types';
import type { DocumentMessagesPanelProps } from '../components/DocumentMessagesPanel';
import type { DocumentMessageTypingUser } from '../utils/document-message-typing';
import { resolveConfirmMediaUrl } from '../utils/confirm-media-url';
import { CommentSelectionCapturePlugin } from './CommentSelectionCapturePlugin';
import { FlowDocsLinkPlugin, LinkClickPlugin } from './FlowDocsLinkPlugin';
import { FlowDocsTablePlugin } from './FlowDocsTablePlugin';
import { FlowDocsTableNode } from './nodes/FlowDocsTableNode';
import { FileAttachmentFloatingToolbar } from './FileAttachmentFloatingToolbar';
import { FileAttachmentSelectionPlugin } from './FileAttachmentSelectionPlugin';
import { DocumentExportModal } from '../components/DocumentExportModal';
import { persistFileAttachmentSelection } from './fileAttachmentSelection';
import { TableFloatingToolbar } from './TableFloatingToolbar';
import { ToolbarTableButton } from './ToolbarTableButton';
import {
  logRestoredContainsTable,
  logSerializedContainsTable,
  logSerializedTableLayout,
} from './tableUtils';
import { selectionIsInsideLink } from './linkFormatting';
import { ToolbarLinkButton } from './ToolbarLinkButton';
import { DocumentEditorCapabilitiesProvider } from './DocumentEditorCapabilitiesContext';
import { ImageClipboardPlugin } from './ImageClipboardPlugin';
import { ImageDragDropPlugin } from './ImageDragDropPlugin';
import {
  DOCUMENT_FILE_INPUT_ACCEPT,
  logFileAttachmentInserted,
  logSerializedContainsFileAttachment,
  sanitizeFileDisplayName,
  validateDocumentUploadFile,
} from './fileAttachmentUtils';
import {
  $createFileAttachmentNode,
  FileAttachmentNode,
} from './nodes/FileAttachmentNode';
import { $createImageNode, $selectImageNodeIfPresent, ImageNode } from './nodes/ImageNode';
import { getUserColor } from './user-colors';
import { presenceDotColor, presenceGradientCss } from './documentPresenceGradients';
import editorShell from './DocumentEditorShell.module.css';
import { PresenceActivityFeed } from './PresenceActivityFeed';
import { DocumentOutlinePanel } from './DocumentOutlinePanel';
import type { DocumentEditorShellPresenceActivity } from './presenceActivityUtils';
export type { DocumentEditorShellPresenceActivity } from './presenceActivityUtils';
import {
  editorStateContainsCodeFormat,
  logCodeFormatApplied,
  logRestoredContainsCode,
  logSerializedContainsCode,
  serializedContainsCodeFormat,
} from './codeFormatUtils';
import {
  getCodeBlockTextLengthFromEditor,
  getCodeBlockTextLengthFromSerialized,
  logCodeBlockFallbackBecauseMissing,
  logCodeBlockTextLength,
  logRestoredCodeBlockTextLength,
  logSerializedContainsCodeBlock,
  normalizeSerializedCodeBlocks,
  serializedContainsCodeBlock,
} from './codeBlockUtils';
import {
  applyActiveInsertionTextColor,
  applyTextColorInEditor,
  insertionColorDiffersFromActive,
  normalizeTextColor,
  readStoredActiveTextColor,
  TEXT_COLOR_PALETTE,
  writeStoredActiveTextColor,
} from './textColorFormatting';
import {
  applyHighlightInEditor,
  clearHighlightInEditor,
  HIGHLIGHT_PALETTE,
  logRestoredContainsHighlight,
  logSerializedContainsHighlight,
  normalizeHighlightColor,
  readStoredActiveHighlightColor,
  readHighlightFromSelection,
  selectionIsInsideCodeBlock,
  writeStoredActiveHighlightColor,
} from './highlightFormatting';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';
type ToolbarBlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'code';
const LOAD_ORIGIN = 'load';
const EDITOR_ORIGIN = 'editor';
const REMOTE_ORIGIN = 'remote';
const SYNC_FROM_YJS_TAG = 'sync-from-yjs';

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

function devRestoreDebugLog(message: string, data?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (data) {
    // eslint-disable-next-line no-console -- dev-only document restore tracing
    console.log('[restore-debug]', message, data);
  } else {
    // eslint-disable-next-line no-console -- dev-only document restore tracing
    console.log('[restore-debug]', message);
  }
}

const EDITOR_THEME = {
  text: {
    bold: 'flowdocs-text-bold',
    italic: 'flowdocs-text-italic',
    underline: 'flowdocs-text-underline',
    strikethrough: 'flowdocs-text-strikethrough',
    code: 'flowdocs-text-code',
  },
  heading: {
    h1: 'flowdocs-heading-h1',
    h2: 'flowdocs-heading-h2',
    h3: 'flowdocs-heading-h3',
  },
  list: {
    ul: 'flowdocs-list-ul',
    ol: 'flowdocs-list-ol',
    listitem: 'flowdocs-list-item',
  },
  code: 'flowdocs-code-block',
  link: 'flowdocs-link',
  fileAttachment: 'flowdocs-file-attachment-node',
  table: 'flowdocs-table',
  tableScrollableWrapper: 'flowdocs-table-scroll',
  tableCell: 'flowdocs-table-cell',
  tableCellSelected: 'flowdocs-table-cell-selected',
  tableRow: 'flowdocs-table-row',
};

interface ActiveUser {
  userId: string;
  fullName: string;
}

interface RemoteCursor {
  documentId: string;
  userId: string;
  fullName: string;
  color: string;
  anchorOffset: number;
  focusOffset: number;
  updatedAt: string;
}

const PRESENCE_STATUS_ACTIVE = ['Düzenliyor…', 'Okuyor', 'Yazıyor…'] as const;

function cursorHintFromRemote(userId: string, cursors: RemoteCursor[]): string | null {
  const c = cursors.find((x) => x.userId === userId);
  if (!c) return null;
  const o = Math.max(0, Math.floor(c.focusOffset));
  const line = Math.max(1, Math.floor(o / 70) + 1);
  const col = Math.max(1, (o % 70) + 1);
  return `↳ Satır ${line}, Sütun ${col}`;
}

interface DocumentPresenceEvent {
  documentId: string;
  activeUsers: ActiveUser[];
}

interface DocumentCursorEvent {
  documentId: string;
  cursors: RemoteCursor[];
}

export interface DocumentEditorShellMemberAvatar {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
}

interface DocumentUpdateEvent {
  documentId: string;
  updateBase64: string;
  sourceClientId?: string;
  editorStateJson?: string;
}

interface DocumentMemberUpdatedEvent {
  documentId: string;
}

interface DocumentMessageCreatedEvent {
  documentId: string;
  message: {
    id: string;
    documentId: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; email: string };
    isMine?: boolean;
  };
}

interface DocumentMessageDeletedEvent {
  documentId: string;
  messageId: string;
}

interface DocumentMessageTypingEvent {
  documentId: string;
  user: DocumentMessageTypingUser;
  isTyping: boolean;
}

interface CursorSelectionOverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RemoteCursorOverlayLayout {
  userId: string;
  fullName: string;
  color: string;
  caretTop: number;
  caretLeft: number;
  caretHeight: number;
  selectionRect: CursorSelectionOverlayRect | null;
}

function getEditableElementForDocument(documentId: string): HTMLElement | null {
  const editable = document.querySelector(
    `[contenteditable][data-document-id="${documentId}"]`,
  );
  return editable instanceof HTMLElement ? editable : null;
}

function createCollapsedRangeFromTextOffset(
  root: HTMLElement,
  targetOffset: number,
): Range | null {
  try {
    const normalizedOffset = Math.max(0, Math.floor(targetOffset));
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let lastTextNode: globalThis.Text | null = null;

    while (node) {
      if (!(node instanceof globalThis.Text)) {
        node = walker.nextNode();
        continue;
      }

      lastTextNode = node;
      const textLength = node.textContent?.length ?? 0;
      let low = 0;
      let high = textLength;

      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        const probe = doc.createRange();
        probe.selectNodeContents(root);
        probe.setEnd(node, mid);
        const measured = probe.toString().length;
        if (measured < normalizedOffset) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      const candidate = doc.createRange();
      candidate.selectNodeContents(root);
      candidate.setEnd(node, low);
      const candidateLength = candidate.toString().length;
      if (candidateLength >= normalizedOffset) {
        const collapsed = doc.createRange();
        collapsed.setStart(node, low);
        collapsed.collapse(true);
        return collapsed;
      }

      node = walker.nextNode();
    }

    const fallback = doc.createRange();
    if (lastTextNode) {
      fallback.setStart(lastTextNode, lastTextNode.textContent?.length ?? 0);
    } else {
      fallback.selectNodeContents(root);
      fallback.collapse(false);
    }
    fallback.collapse(true);
    return fallback;
  } catch {
    return null;
  }
}

function createRangeBetweenTextOffsets(
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
): Range | null {
  const start = createCollapsedRangeFromTextOffset(root, startOffset);
  const end = createCollapsedRangeFromTextOffset(root, endOffset);
  if (!start || !end) {
    return null;
  }

  try {
    const selectionRange = root.ownerDocument.createRange();
    selectionRange.setStart(start.startContainer, start.startOffset);
    selectionRange.setEnd(end.startContainer, end.startOffset);
    return selectionRange;
  } catch {
    return null;
  }
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function mergePendingUpdates(updates: Uint8Array[]): Uint8Array {
  if (updates.length === 1) {
    return updates[0]!;
  }
  return Y.mergeUpdates(updates);
}

function getRealtimeBaseUrl(): string {
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  return apiBase.replace(/\/api\/?$/, '');
}

function readEditorText(): string {
  const root = $getRoot();
  const paragraphs = root.getChildren();
  if (paragraphs.length === 0) {
    return '';
  }
  return paragraphs.map((node) => node.getTextContent()).join('\n');
}

function writeEditorText(value: string): void {
  const root = $getRoot();
  root.clear();

  const lines = value.split('\n');
  if (lines.length === 0) {
    root.append($createParagraphNode());
    return;
  }

  for (const line of lines) {
    const paragraph = $createParagraphNode();
    if (line.length > 0) {
      paragraph.append($createTextNode(line));
    }
    root.append(paragraph);
  }
}

interface LexicalJsonRecoveryResult {
  isLexicalSerialized: boolean;
  plainText: string;
}

function extractTextFromSerializedNode(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }

  const maybeText = (node as { text?: unknown }).text;
  if (typeof maybeText === 'string') {
    return maybeText;
  }

  const children = (node as { children?: unknown }).children;
  if (!Array.isArray(children)) {
    return '';
  }

  return children.map((child) => extractTextFromSerializedNode(child)).join('');
}

function recoverPlainTextFromLexicalSerialized(value: string): LexicalJsonRecoveryResult {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) {
    return { isLexicalSerialized: false, plainText: '' };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('root' in parsed) ||
      typeof (parsed as { root?: unknown }).root !== 'object' ||
      (parsed as { root: unknown }).root === null
    ) {
      return { isLexicalSerialized: false, plainText: '' };
    }

    const root = (parsed as { root: { children?: unknown } }).root;
    if (!Array.isArray(root.children)) {
      return { isLexicalSerialized: false, plainText: '' };
    }

    const lines = root.children
      .map((child) => extractTextFromSerializedNode(child))
      .filter((line) => line.length > 0);

    return {
      isLexicalSerialized: true,
      plainText: lines.join('\n'),
    };
  } catch {
    return { isLexicalSerialized: false, plainText: '' };
  }
}

function normalizeFallbackPlainText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const lexicalRecovery = recoverPlainTextFromLexicalSerialized(value);
  if (lexicalRecovery.isLexicalSerialized) {
    return lexicalRecovery.plainText;
  }
  return value;
}

function extractSerializedLexicalRoot(
  value: string,
): { root: { children?: unknown } } | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    const candidate =
      typeof parsed === 'object' &&
      parsed !== null &&
      'editorState' in parsed &&
      typeof (parsed as { editorState?: unknown }).editorState === 'object' &&
      (parsed as { editorState?: unknown }).editorState !== null
        ? (parsed as { editorState: unknown }).editorState
        : parsed;

    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('root' in candidate) ||
      typeof (candidate as { root?: unknown }).root !== 'object' ||
      (candidate as { root: unknown }).root === null
    ) {
      return null;
    }

    return candidate as { root: { children?: unknown } };
  } catch {
    return null;
  }
}

function isValidSerializedLexicalState(value: string): boolean {
  const normalized = extractSerializedLexicalRoot(value);
  if (!normalized) {
    return false;
  }
  return Array.isArray(normalized.root.children);
}

function hasRichLexicalSnapshot(
  serialized: string | null | undefined,
): serialized is string {
  return typeof serialized === 'string' && serialized.length > 0 && isValidSerializedLexicalState(serialized);
}

function tryApplySerializedLexicalState(
  editor: LexicalEditor,
  serialized: string,
): boolean {
  const normalizedSerialized = normalizeSerializedCodeBlocks(serialized);
  if (!isValidSerializedLexicalState(normalizedSerialized)) {
    return false;
  }

  try {
    const parsed = extractSerializedLexicalRoot(normalizedSerialized) as Parameters<
      LexicalEditor['parseEditorState']
    >[0] | null;
    if (!parsed) return false;
    const nextState = editor.parseEditorState(parsed);
    editor.setEditorState(nextState, { tag: SYNC_FROM_YJS_TAG });
    return true;
  } catch {
    return false;
  }
}

function replaceYTextValue(ytext: Y.Text, value: string): void {
  const current = ytext.toString();
  if (current.length > 0) {
    ytext.delete(0, current.length);
  }
  if (value.length > 0) {
    ytext.insert(0, value);
  }
}

interface DocumentRestorePayload {
  editorStateJson: string;
  previewPlainText: string;
  allowEmptyPublish: boolean;
}

function readLexicalRootMetrics(editor: LexicalEditor): {
  rootTextLength: number;
  childCount: number;
} {
  return editor.getEditorState().read(() => {
    const root = $getRoot();
    return {
      rootTextLength: root.getTextContent().length,
      childCount: root.getChildren().length,
    };
  });
}

function yjsHasSubstantiveContent(
  ytext: Y.Text,
  ylexicalState: Y.Map<string>,
): boolean {
  if (ytext.toString().trim().length > 0) return true;
  return hasRichLexicalSnapshot(ylexicalState.get('serialized'));
}

interface PersistGuardContext {
  allowEmptyPublish: boolean;
  editorStateJson: string;
  previewPlainText: string;
  hasRestoredNonEmpty: boolean;
}

/** True when local lexical state has no text and no rich/media snapshot worth preserving. */
function isLocalLexicalUpdateEffectivelyEmpty(
  nextText: string,
  nextSerialized: string,
): boolean {
  if (nextText.trim().length > 0) return false;
  if (hasRichLexicalSnapshot(nextSerialized)) return false;
  const serializedPlain = recoverPlainTextFromLexicalSerialized(nextSerialized).plainText.trim();
  return serializedPlain.length === 0;
}

function shouldBlockDestructiveEmptyPublish(
  nextText: string,
  nextSerialized: string,
  ytext: Y.Text,
  ylexicalState: Y.Map<string>,
  ctx: PersistGuardContext,
): { block: true; reason: string } | { block: false } {
  if (!isLocalLexicalUpdateEffectivelyEmpty(nextText, nextSerialized)) {
    return { block: false };
  }

  if (ctx.hasRestoredNonEmpty) {
    return { block: true, reason: 'restored-non-empty' };
  }

  const yjsHasContent = yjsHasSubstantiveContent(ytext, ylexicalState);
  const apiHadContent =
    ctx.editorStateJson.trim().length > 0 || ctx.previewPlainText.length > 0;

  if (yjsHasContent || apiHadContent) {
    return {
      block: true,
      reason: yjsHasContent ? 'yjs-has-content' : 'api-had-content',
    };
  }

  if (!ctx.allowEmptyPublish) {
    return { block: true, reason: 'not-truly-empty-document' };
  }

  return { block: false };
}

function logYjsRestoreState(ytext: Y.Text, ylexicalState: Y.Map<string>): void {
  const serialized = ylexicalState.get('serialized');
  const plain = ytext.toString();
  const serializedTextLength =
    typeof serialized === 'string' ? recoverPlainTextFromLexicalSerialized(serialized).plainText.length : 0;
  devRestoreDebugLog('yjs after apply', {
    ytextLength: plain.length,
    hasSerialized: typeof serialized === 'string' && serialized.length > 0,
    hasRichSerialized: hasRichLexicalSnapshot(serialized),
    serializedTextLength,
    plainTextLength: plain.length,
  });
}

function syncEditorStateToYjs(
  editor: LexicalEditor,
  ydoc: Y.Doc,
  ytext: Y.Text,
  ylexicalState: Y.Map<string>,
  lastAppliedRef: MutableRefObject<string | null>,
  origin: unknown = LOAD_ORIGIN,
): void {
  const nextText = editor.getEditorState().read(() => readEditorText());
  const nextSerialized = normalizeSerializedCodeBlocks(
    JSON.stringify(editor.getEditorState().toJSON()),
  );
  ydoc.transact(() => {
    replaceYTextValue(ytext, nextText);
    ylexicalState.set('serialized', nextSerialized);
  }, origin);
  lastAppliedRef.current = nextSerialized;
}

function applyYjsSnapshotToLexical(
  editor: LexicalEditor,
  ytext: Y.Text,
  ylexicalState: Y.Map<string>,
  lastAppliedRef: MutableRefObject<string | null>,
): void {
  const serializedState = ylexicalState.get('serialized');
  if (hasRichLexicalSnapshot(serializedState)) {
    if (tryApplySerializedLexicalState(editor, serializedState)) {
      lastAppliedRef.current = serializedState;
    }
    return;
  }

  const nextText = ytext.toString();
  const lexicalRecovery = recoverPlainTextFromLexicalSerialized(nextText);
  const textToWrite = lexicalRecovery.isLexicalSerialized
    ? lexicalRecovery.plainText
    : nextText;
  editor.update(() => writeEditorText(textToWrite), { tag: SYNC_FROM_YJS_TAG });
}

interface RestoreLifecycleRefs {
  restoreCompleteRef: MutableRefObject<boolean>;
  hasRestoredNonEmptyRef: MutableRefObject<boolean>;
  restorePayloadRef: MutableRefObject<DocumentRestorePayload | null>;
}

interface YjsLexicalBridgePluginProps {
  ydoc: Y.Doc;
  ytext: Y.Text;
  ylexicalState: Y.Map<string>;
  canEdit: boolean;
  restorePayload: DocumentRestorePayload;
  restoreLifecycle: RestoreLifecycleRefs;
}

function YjsLexicalBridgePlugin({
  ydoc,
  ytext,
  ylexicalState,
  canEdit,
  restorePayload,
  restoreLifecycle,
}: YjsLexicalBridgePluginProps) {
  const [editor] = useLexicalComposerContext();
  const lastAppliedSerializedRef = useRef<string | null>(null);
  const restoreCompleteRef = restoreLifecycle.restoreCompleteRef;
  const hasRestoredNonEmptyRef = restoreLifecycle.hasRestoredNonEmptyRef;
  const allowEmptyPublishRef = useRef(restorePayload.allowEmptyPublish);

  useEffect(() => {
    allowEmptyPublishRef.current = restorePayload.allowEmptyPublish;
  }, [restorePayload.allowEmptyPublish]);

  useEffect(() => {
    restoreCompleteRef.current = false;
    const originLabel = (origin?: unknown) =>
      origin === LOAD_ORIGIN
        ? 'load'
        : origin === EDITOR_ORIGIN
          ? 'editor'
          : origin === REMOTE_ORIGIN
            ? 'remote'
            : String(origin ?? 'unknown');

    interface SyncFromYjsOptions {
      origin?: unknown;
      source?: 'ytext' | 'ylexical' | 'init';
      forceApply?: boolean;
      onRestored?: () => void;
    }

    const syncFromYjs = (options: SyncFromYjsOptions = {}) => {
      const { origin, source = 'init', forceApply: forceApplyOverride, onRestored } = options;
      const forceApply = forceApplyOverride ?? origin === REMOTE_ORIGIN;
      const finishRestore = onRestored;

      devRealtimeDebugLog('syncFromYjs start', {
        origin: originLabel(origin),
        source,
        forceApply,
      });

      if (origin === EDITOR_ORIGIN) {
        devRealtimeDebugLog('syncFromYjs skipped', { reason: 'editor-origin' });
        return;
      }

      const serializedState = ylexicalState.get('serialized');
      const richSnapshotInYjs = hasRichLexicalSnapshot(serializedState);

      if (richSnapshotInYjs) {
        const editorSerialized = JSON.stringify(editor.getEditorState().toJSON());
        const yjsCodeBlockLen = getCodeBlockTextLengthFromSerialized(serializedState);
        const editorCodeBlockLen = getCodeBlockTextLengthFromEditor(editor);
        const codeBlockContentStale = yjsCodeBlockLen > editorCodeBlockLen;
        const editorMetrics = readLexicalRootMetrics(editor);
        const editorEmptyButYjsRich =
          editorMetrics.rootTextLength === 0 && richSnapshotInYjs;
        const needsLexicalApply =
          forceApply ||
          editorEmptyButYjsRich ||
          serializedState !== lastAppliedSerializedRef.current ||
          editorSerialized !== serializedState ||
          codeBlockContentStale;
        const shouldApply = needsLexicalApply;

        devRealtimeDebugLog(
          forceApply
            ? 'syncFromYjs path: rich serialized forceApply'
            : 'syncFromYjs path: rich serialized',
          {
            origin: originLabel(origin),
            forceApply,
            needsLexicalApply,
            shouldApply,
            codeBlockContentStale,
            yjsCodeBlockLen,
            editorCodeBlockLen,
            serializedLen: serializedState.length,
            lastAppliedLen: lastAppliedSerializedRef.current?.length ?? 0,
          },
        );

        if (shouldApply) {
          if (tryApplySerializedLexicalState(editor, serializedState)) {
            lastAppliedSerializedRef.current = serializedState;
            devRealtimeDebugLog('lexical editor state applied', {
              origin: originLabel(origin),
              forceApply,
              path: 'rich-serialized',
            });
            finishRestore?.();
          } else {
            devRealtimeDebugLog('syncFromYjs skipped', {
              reason: 'rich-serialized-apply-failed',
              origin: originLabel(origin),
              forceApply,
            });
          }
        } else if (editorEmptyButYjsRich) {
          devRestoreDebugLog('forcing lexical apply', {
            reason: 'editor-empty-yjs-rich',
            origin: originLabel(origin),
          });
          if (tryApplySerializedLexicalState(editor, serializedState)) {
            lastAppliedSerializedRef.current = serializedState;
            finishRestore?.();
          }
        } else {
          devRealtimeDebugLog('syncFromYjs skipped', {
            reason: 'rich-serialized-already-in-sync',
            origin: originLabel(origin),
            forceApply,
          });
          finishRestore?.();
        }

        // Never fall back to plain ytext while Yjs carries a rich Lexical snapshot (preserves colors).
        return;
      }

      const nextText = ytext.toString();
      const lexicalRecovery = recoverPlainTextFromLexicalSerialized(nextText);
      if (lexicalRecovery.isLexicalSerialized) {
        devRealtimeDebugLog('syncFromYjs path: recovered plain text', {
          origin: originLabel(origin),
          forceApply,
          ytextLen: nextText.length,
        });
        const recoveredText = lexicalRecovery.plainText;
        editor.update(
          () => {
            const currentText = readEditorText();
            if (currentText === recoveredText && !forceApply) return;
            writeEditorText(recoveredText);
          },
          {
            tag: SYNC_FROM_YJS_TAG,
            onUpdate: () => finishRestore?.(),
          },
        );

        if (nextText !== recoveredText && canEdit) {
          ydoc.transact(() => {
            replaceYTextValue(ytext, recoveredText);
          }, EDITOR_ORIGIN);
        }
        devRealtimeDebugLog('lexical editor state applied', {
          origin: originLabel(origin),
          forceApply,
          path: 'recovered-plain-text',
        });
        return;
      }

      devRealtimeDebugLog('syncFromYjs path: plain ytext', {
        origin: originLabel(origin),
        forceApply,
        ytextLen: nextText.length,
      });

      editor.update(
        () => {
          const currentText = readEditorText();
          if (currentText === nextText && !forceApply) {
            devRealtimeDebugLog('syncFromYjs skipped', {
              reason: 'plain-ytext-editor-already-matches',
              origin: originLabel(origin),
              forceApply,
            });
            return;
          }
          writeEditorText(nextText);
        },
        {
          tag: SYNC_FROM_YJS_TAG,
          onUpdate: () => finishRestore?.(),
        },
      );

      devRealtimeDebugLog('lexical editor state applied', {
        origin: originLabel(origin),
        forceApply,
        path: 'plain-ytext',
      });
    };

    let cancelled = false;

    const runInitialRestore = () => {
      if (cancelled) return;

      applyYjsSnapshotToLexical(editor, ytext, ylexicalState, lastAppliedSerializedRef);
      let metrics = readLexicalRootMetrics(editor);
      const yjsSerializedAfterApply = ylexicalState.get('serialized');
      if (
        metrics.rootTextLength === 0 &&
        hasRichLexicalSnapshot(yjsSerializedAfterApply) &&
        typeof yjsSerializedAfterApply === 'string'
      ) {
        devRestoreDebugLog('forcing lexical apply after empty yjs snapshot', {
          serializedLen: yjsSerializedAfterApply.length,
        });
        if (tryApplySerializedLexicalState(editor, yjsSerializedAfterApply)) {
          lastAppliedSerializedRef.current = yjsSerializedAfterApply;
          metrics = readLexicalRootMetrics(editor);
        }
      }
      devRestoreDebugLog('lexical after restore', metrics);

      const apiCodeBlockTextLen = getCodeBlockTextLengthFromSerialized(
        restorePayload.editorStateJson,
      );
      let lexicalCodeBlockTextLen = getCodeBlockTextLengthFromEditor(editor);
      logCodeBlockTextLength('after-yjs-restore', lexicalCodeBlockTextLen);
      if (serializedContainsCodeBlock(restorePayload.editorStateJson)) {
        logCodeBlockTextLength('api-editorStateJson', apiCodeBlockTextLen);
      }

      const apiHasCode = serializedContainsCodeFormat(restorePayload.editorStateJson);
      const lexicalHasCode = editorStateContainsCodeFormat(editor);
      const needsCodeBlockFallback =
        apiCodeBlockTextLen > 0 && lexicalCodeBlockTextLen < apiCodeBlockTextLen;
      const needsEditorStateJsonFallback =
        restorePayload.editorStateJson.length > 0 &&
        (metrics.rootTextLength === 0 ||
          (apiHasCode && !lexicalHasCode) ||
          needsCodeBlockFallback);

      if (needsEditorStateJsonFallback) {
        if (needsCodeBlockFallback) {
          logCodeBlockFallbackBecauseMissing();
        }
        devRestoreDebugLog('applying lexical editorStateJson fallback', {
          reason: metrics.rootTextLength === 0
            ? 'empty-root'
            : needsCodeBlockFallback
              ? 'code-block-text'
              : 'code-format',
        });
        if (tryApplySerializedLexicalState(editor, restorePayload.editorStateJson)) {
          lastAppliedSerializedRef.current = restorePayload.editorStateJson;
          syncEditorStateToYjs(
            editor,
            ydoc,
            ytext,
            ylexicalState,
            lastAppliedSerializedRef,
            LOAD_ORIGIN,
          );
        }
        metrics = readLexicalRootMetrics(editor);
        lexicalCodeBlockTextLen = getCodeBlockTextLengthFromEditor(editor);
        devRestoreDebugLog('lexical after restore', {
          ...metrics,
          pass: 'editorStateJson-fallback',
          codeBlockTextLen: lexicalCodeBlockTextLen,
        });
      }

      if (metrics.rootTextLength === 0 && restorePayload.previewPlainText.length > 0) {
        devRestoreDebugLog('applying lexical previewContent fallback');
        editor.update(() => writeEditorText(restorePayload.previewPlainText), {
          tag: SYNC_FROM_YJS_TAG,
        });
        syncEditorStateToYjs(
          editor,
          ydoc,
          ytext,
          ylexicalState,
          lastAppliedSerializedRef,
          LOAD_ORIGIN,
        );
        metrics = readLexicalRootMetrics(editor);
        devRestoreDebugLog('lexical after restore', { ...metrics, pass: 'preview-fallback' });
      }

      logRestoredCodeBlockTextLength(editor);
      logRestoredContainsTable(editor);
      metrics = readLexicalRootMetrics(editor);
      if (metrics.rootTextLength > 0 || yjsHasSubstantiveContent(ytext, ylexicalState)) {
        hasRestoredNonEmptyRef.current = true;
      }
      devRestoreDebugLog('restore completed', {
        ...metrics,
        allowEmptyPublish: restorePayload.allowEmptyPublish,
      });
      if (restorePayload.allowEmptyPublish) {
        devRestoreDebugLog('allow empty publish only for truly empty document');
      }
      logRestoredContainsCode(editor);
      logRestoredContainsHighlight(editor);
      restoreCompleteRef.current = true;
    };

    // Defer Lexical state writes past commit — avoids flushSync-in-lifecycle warning.
    queueMicrotask(runInitialRestore);

    const onTextObserve = (event: Y.YTextEvent) => {
      devRealtimeDebugLog('yjs observe fired', {
        target: 'ytext',
        origin: originLabel(event.transaction.origin),
      });
      syncFromYjs({
        origin: event.transaction.origin,
        source: 'ytext',
        forceApply: event.transaction.origin === REMOTE_ORIGIN,
      });
    };
    const onLexicalObserve = (event: Y.YMapEvent<string>) => {
      devRealtimeDebugLog('yjs observe fired', {
        target: 'ylexicalState',
        origin: originLabel(event.transaction.origin),
        keys: event.keysChanged.size,
      });
      syncFromYjs({
        origin: event.transaction.origin,
        source: 'ylexical',
        forceApply: event.transaction.origin === REMOTE_ORIGIN,
      });
    };
    ytext.observe(onTextObserve);
    ylexicalState.observe(onLexicalObserve);

    return () => {
      cancelled = true;
      ytext.unobserve(onTextObserve);
      ylexicalState.unobserve(onLexicalObserve);
    };
  }, [canEdit, editor, restorePayload, ydoc, ylexicalState, ytext]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }) => {
      if (tags.has(SYNC_FROM_YJS_TAG)) {
        devRealtimeDebugLog('local lexical update skipped', { reason: 'sync-from-yjs-tag' });
        return;
      }
      if (!restoreCompleteRef.current) {
        devRestoreDebugLog('blocked flush before restore');
        return;
      }
      if (!canEdit) {
        devRealtimeDebugLog('local lexical update skipped', { reason: 'view-only' });
        return;
      }

      devRealtimeDebugLog('local lexical update detected');

      const nextText = editorState.read(() => readEditorText());
      const nextSerialized = normalizeSerializedCodeBlocks(JSON.stringify(editorState.toJSON()));

      const payload = restoreLifecycle.restorePayloadRef.current;
      const persistGuard: PersistGuardContext = {
        allowEmptyPublish: allowEmptyPublishRef.current,
        editorStateJson: payload?.editorStateJson ?? '',
        previewPlainText: payload?.previewPlainText ?? '',
        hasRestoredNonEmpty: hasRestoredNonEmptyRef.current,
      };
      const emptyPublishBlock = shouldBlockDestructiveEmptyPublish(
        nextText,
        nextSerialized,
        ytext,
        ylexicalState,
        persistGuard,
      );
      if (emptyPublishBlock.block) {
        devRestoreDebugLog('blocked destructive empty publish', {
          reason: emptyPublishBlock.reason,
        });
        return;
      }

      const hasExistingText = ytext.toString().trim().length > 0;
      const existingSerialized = ylexicalState.get('serialized');
      const existingSerializedText =
        typeof existingSerialized === 'string'
          ? recoverPlainTextFromLexicalSerialized(existingSerialized).plainText
          : '';
      const hasExistingSerializedText = existingSerializedText.trim().length > 0;
      const prevSerialized =
        typeof existingSerialized === 'string' ? existingSerialized : '';
      const serializedChanged = prevSerialized !== nextSerialized;
      // Plain-text snapshot ignores images; still persist when Lexical JSON changed (e.g. image-only blocks).
      if (
        nextText.trim().length === 0 &&
        (hasExistingText || hasExistingSerializedText) &&
        !serializedChanged
      ) {
        devRealtimeDebugLog('local lexical update skipped', {
          reason: 'empty-text-guard',
        });
        return;
      }

      const isTextUnchanged = nextText === ytext.toString();
      const isSerializedUnchanged = ylexicalState.get('serialized') === nextSerialized;
      if (isTextUnchanged && isSerializedUnchanged) {
        devRealtimeDebugLog('local lexical update skipped', {
          reason: 'yjs-already-matches',
        });
        return;
      }

      ydoc.transact(() => {
        replaceYTextValue(ytext, nextText);
        ylexicalState.set('serialized', nextSerialized);
      }, EDITOR_ORIGIN);
      lastAppliedSerializedRef.current = nextSerialized;
      logSerializedContainsCode(nextSerialized);
      logSerializedContainsTable(nextSerialized);
      logSerializedTableLayout(nextSerialized);
      logSerializedContainsHighlight(nextSerialized);
      logSerializedContainsFileAttachment(nextSerialized);
      devRealtimeDebugLog('yjs update produced', {
        textLen: nextText.length,
        serializedLen: nextSerialized.length,
      });
    });
  }, [canEdit, editor, ydoc, ylexicalState, ytext]);

  return null;
}

function ToolbarDivider() {
  return <span className={editorShell.toolbarDivider} aria-hidden />;
}

interface ToolbarIconButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  uiOnly?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

function ToolbarIconButton({
  label,
  active,
  disabled,
  uiOnly,
  onClick,
  children,
}: ToolbarIconButtonProps) {
  const isDisabled = disabled || uiOnly;
  return (
    <Tooltip label={label} withArrow position="bottom" openDelay={350}>
      <UnstyledButton
        type="button"
        className={`${editorShell.toolbarIconBtn}${active ? ` ${editorShell.toolbarIconBtnActive}` : ''}${uiOnly ? ` ${editorShell.toolbarIconBtnUiOnly}` : ''}`}
        disabled={isDisabled}
        data-flowdocs-toolbar-active={active ? '' : undefined}
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={isDisabled ? undefined : onClick}
      >
        {children}
      </UnstyledButton>
    </Tooltip>
  );
}

function ToolbarTextColorButton({
  disabled,
  activeTextColor,
  onActiveTextColorChange,
  editor,
  lastSelectionRef,
}: {
  disabled?: boolean;
  activeTextColor: string;
  onActiveTextColorChange: (color: string) => void;
  editor: LexicalEditor;
  lastSelectionRef: React.MutableRefObject<RangeSelection | null>;
}) {
  const [opened, setOpened] = useState(false);

  const handlePick = (color: string) => {
    const normalized = normalizeTextColor(color);
    onActiveTextColorChange(normalized);
    applyTextColorInEditor(editor, normalized, lastSelectionRef.current);
    editor.focus();
    setOpened(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      withArrow
      shadow="md"
      withinPortal
      zIndex={500}
      disabled={disabled}
    >
      <Popover.Target>
        <Tooltip label="Yazı rengi" withArrow position="bottom" openDelay={350}>
          <UnstyledButton
            type="button"
            className={editorShell.toolbarIconBtn}
            disabled={disabled}
            aria-label="Yazı rengi"
            aria-expanded={opened}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => !disabled && setOpened((o) => !o)}
          >
            <span className={editorShell.toolbarColorBtnInner}>
              <IconLetterA size={18} stroke={2} />
              <span
                className={editorShell.toolbarColorPreview}
                style={{ backgroundColor: activeTextColor }}
                aria-hidden
              />
            </span>
          </UnstyledButton>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className={editorShell.textColorPopover}>
        <Text className={editorShell.textColorPopoverTitle}>Metin rengi</Text>
        <div className={editorShell.textColorGrid} role="listbox" aria-label="Metin rengi">
          {TEXT_COLOR_PALETTE.map((color) => {
            const selected = normalizeTextColor(activeTextColor) === normalizeTextColor(color);
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={selected}
                className={`${editorShell.textColorSwatch}${selected ? ` ${editorShell.textColorSwatchSelected}` : ''}`}
                style={{ backgroundColor: color }}
                title={color}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(color)}
              />
            );
          })}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

function ToolbarHighlightButton({
  disabled,
  activeHighlightColor,
  onActiveHighlightColorChange,
  editor,
  lastSelectionRef,
}: {
  disabled?: boolean;
  activeHighlightColor: string;
  onActiveHighlightColorChange: (color: string) => void;
  editor: LexicalEditor;
  lastSelectionRef: React.MutableRefObject<RangeSelection | null>;
}) {
  const [opened, setOpened] = useState(false);
  const [previewCleared, setPreviewCleared] = useState(false);

  const notifySelectTextFirst = () => {
    notifications.show({
      title: 'Vurgu',
      message: 'Önce metin seçin',
      color: 'yellow',
    });
  };

  const resolveHighlightTarget = (): 'ok' | 'empty' | 'code-block' => {
    let result: 'empty' | 'code-block' | 'ok' = 'empty';
    editor.getEditorState().read(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection) && lastSelectionRef.current) {
        selection = lastSelectionRef.current;
      }
      if (!$isRangeSelection(selection) || selection.isCollapsed()) return;
      if (selectionIsInsideCodeBlock(selection)) {
        result = 'code-block';
        return;
      }
      result = 'ok';
    });
    return result;
  };

  const handlePick = (color: string | null) => {
    editor.focus();

    const target = resolveHighlightTarget();
    if (target === 'code-block') return;

    if (color === null) {
      const cleared = clearHighlightInEditor(editor, lastSelectionRef.current);
      if (!cleared) {
        if (target !== 'ok') notifySelectTextFirst();
        return;
      }
      setPreviewCleared(true);
      setOpened(false);
      return;
    }

    const normalized = normalizeHighlightColor(color);
    onActiveHighlightColorChange(normalized);
    setPreviewCleared(false);

    if (target !== 'ok') {
      notifySelectTextFirst();
      return;
    }

    const applied = applyHighlightInEditor(editor, normalized, lastSelectionRef.current);
    if (!applied) {
      notifySelectTextFirst();
      return;
    }

    setOpened(false);
  };

  const previewStyle = previewCleared
    ? undefined
    : { backgroundColor: activeHighlightColor };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom"
      withArrow
      shadow="md"
      withinPortal
      zIndex={500}
      disabled={disabled}
    >
      <Popover.Target>
        <Tooltip label="Vurgula" withArrow position="bottom" openDelay={350}>
          <UnstyledButton
            type="button"
            className={editorShell.toolbarIconBtn}
            disabled={disabled}
            aria-label="Vurgula"
            aria-expanded={opened}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => !disabled && setOpened((o) => !o)}
          >
            <span className={editorShell.toolbarColorBtnInner}>
              <IconHighlight size={18} stroke={2} />
              <span
                className={`${editorShell.toolbarColorPreview}${previewCleared ? ` ${editorShell.toolbarHighlightPreviewEmpty}` : ''}`}
                style={previewStyle}
                aria-hidden
              />
            </span>
          </UnstyledButton>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className={editorShell.highlightPopover}>
        <Text className={editorShell.highlightPopoverTitle}>Metin vurgusu</Text>
        <div className={editorShell.highlightSwatchGrid} role="listbox" aria-label="Metin vurgusu">
          {HIGHLIGHT_PALETTE.map((entry) => {
            const isClear = entry.value === null;
            const selected =
              !isClear &&
              !previewCleared &&
              normalizeHighlightColor(activeHighlightColor) === normalizeHighlightColor(entry.value);
            return (
              <button
                key={entry.id}
                type="button"
                role="option"
                aria-selected={isClear ? previewCleared : selected}
                aria-label={entry.label}
                title={entry.label}
                className={`${editorShell.highlightSwatch}${isClear ? ` ${editorShell.highlightSwatchClear}` : ''}${selected ? ` ${editorShell.highlightSwatchSelected}` : ''}`}
                style={entry.value ? { backgroundColor: entry.value } : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handlePick(entry.value)}
              />
            );
          })}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

interface EditorToolbarPluginProps {
  disabled: boolean;
  isUploadingImage: boolean;
  isUploadingDocument: boolean;
  onUploadImage: (file: File) => Promise<{ url: string; altText: string } | null>;
  onUploadDocument: (
    file: File,
  ) => Promise<{ url: string; fileName: string; mimeType: string; size: number } | null>;
  trailing?: ReactNode;
}

function EditorToolbarPlugin({
  disabled,
  isUploadingImage,
  isUploadingDocument,
  onUploadImage,
  onUploadDocument,
  trailing,
}: EditorToolbarPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [blockType, setBlockType] = useState<ToolbarBlockType>('paragraph');
  const [activeTextColor, setActiveTextColor] = useState(() => readStoredActiveTextColor());
  const [activeHighlightColor, setActiveHighlightColor] = useState(() =>
    readStoredActiveHighlightColor(),
  );
  const activeTextColorRef = useRef(activeTextColor);
  const lastSelectionRef = useRef<RangeSelection | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const documentFileInputRef = useRef<HTMLInputElement | null>(null);
  const isUploadingMedia = isUploadingImage || isUploadingDocument;

  const setActiveTextColorBoth = useCallback((color: string) => {
    const normalized = normalizeTextColor(color);
    activeTextColorRef.current = normalized;
    setActiveTextColor(normalized);
    writeStoredActiveTextColor(normalized);
  }, []);

  const setActiveHighlightColorBoth = useCallback((color: string) => {
    const normalized = normalizeHighlightColor(color);
    setActiveHighlightColor(normalized);
    writeStoredActiveHighlightColor(normalized);
  }, []);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        let shouldSyncInsertionColor = false;
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          lastSelectionRef.current = selection.clone();
          setIsBold(selection.hasFormat('bold'));
          setIsItalic(selection.hasFormat('italic'));
          setIsUnderline(selection.hasFormat('underline'));
          setIsStrikethrough(selection.hasFormat('strikethrough'));
          setIsCode(selection.hasFormat('code'));
          setIsLink(selectionIsInsideLink());

          if (
            !disabled &&
            selection.isCollapsed() &&
            insertionColorDiffersFromActive(selection, activeTextColorRef.current)
          ) {
            shouldSyncInsertionColor = true;
          }

          if (!disabled && !selection.isCollapsed()) {
            const highlight = readHighlightFromSelection(selection);
            if (highlight) {
              setActiveHighlightColor(normalizeHighlightColor(highlight));
            }
          }

          const anchorNode = selection.anchor.getNode();
          const topLevel = anchorNode.getTopLevelElementOrThrow();
          if ($isHeadingNode(topLevel)) {
            const tag = topLevel.getTag();
            setBlockType(
              tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : tag === 'h3' ? 'h3' : 'paragraph',
            );
            return;
          }

          if ($isListNode(topLevel)) {
            setBlockType(topLevel.getListType() === 'number' ? 'ol' : 'ul');
            return;
          }

          if ($isCodeNode(topLevel)) {
            setBlockType('code');
            return;
          }

          setBlockType('paragraph');
        });

        if (shouldSyncInsertionColor) {
          devRealtimeDebugLog('activeTextColor insertion patch called', {
            color: activeTextColorRef.current,
          });
          applyActiveInsertionTextColor(editor, activeTextColorRef.current);
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [disabled, editor]);

  const withSelection = (action: (selection: RangeSelection) => void) => {
    editor.focus();
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection) && lastSelectionRef.current) {
        $setSelection(lastSelectionRef.current.clone());
        selection = $getSelection();
      }
      if (!$isRangeSelection(selection)) return;
      action(selection);
      lastSelectionRef.current = selection.clone();
    });
  };

  const formatText = (format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    withSelection(() => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
      if (format === 'code') {
        logCodeFormatApplied();
      }
    });
  };

  const applyHeading = (tag: 'h1' | 'h2' | 'h3') => {
    withSelection((selection) => {
      $setBlocksType(selection, () => $createHeadingNode(tag));
    });
  };

  const applyParagraph = () => {
    withSelection((selection) => {
      $setBlocksType(selection, () => $createParagraphNode());
    });
  };

  const applyCodeBlock = () => {
    withSelection((selection) => {
      $setBlocksType(selection, () => $createCodeNode());
    });
  };

  const applyList = (type: 'ul' | 'ol') => {
    withSelection(() => {
      editor.dispatchCommand(
        type === 'ul' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
        undefined,
      );
    });
  };

  const clearFormatting = () => {
    withSelection((selection) => {
      if (selection.hasFormat('bold')) editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
      if (selection.hasFormat('italic')) editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
      if (selection.hasFormat('underline')) editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
      if (selection.hasFormat('strikethrough')) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
      }
      if (selection.hasFormat('code')) {
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
      }
      const topLevel = selection.anchor.getNode().getTopLevelElementOrThrow();
      if (!$isCodeNode(topLevel)) {
        $setBlocksType(selection, () => $createParagraphNode());
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      }
    });
  };

  const handleBlockSelect = (value: string | null) => {
    if (!value) return;
    const next = value as ToolbarBlockType;
    if (next === 'paragraph') {
      applyParagraph();
      return;
    }
    if (next === 'h1') {
      applyHeading('h1');
      return;
    }
    if (next === 'h2') {
      applyHeading('h2');
      return;
    }
    if (next === 'h3') {
      applyHeading('h3');
      return;
    }
    if (next === 'ul') {
      applyList('ul');
      return;
    }
    if (next === 'ol') {
      applyList('ol');
      return;
    }
    if (next === 'code') {
      applyCodeBlock();
    }
  };

  const insertImage = (url: string, altText: string) => {
    const trimmedUrl = typeof url === 'string' ? url.trim() : '';
    if (!trimmedUrl) {
      notifications.show({
        title: 'Image insert failed',
        message: 'No image URL was returned; nothing was added to the document.',
        color: 'red',
      });
      return;
    }

    editor.focus();
    editor.update(() => {
      const imageNode = $createImageNode(trimmedUrl, altText);
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([imageNode]);
      } else {
        $getRoot().append(imageNode);
      }
      $selectImageNodeIfPresent(imageNode.getKey());
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- dev-only image selection debug
        console.log('[image-node] restored selection', {
          nodeKey: imageNode.getKey(),
          reason: 'insert-upload',
        });
      }
    });
  };

  const handleUploadButton = () => {
    fileInputRef.current?.click();
  };

  const handleDocumentUploadButton = () => {
    documentFileInputRef.current?.click();
  };

  const insertFileAttachment = (
    url: string,
    fileName: string,
    mimeType: string,
    size: number,
  ) => {
    const trimmedUrl = typeof url === 'string' ? url.trim() : '';
    if (!trimmedUrl) {
      notifications.show({
        title: 'Dosya eklenemedi',
        message: 'Sunucu dosya adresi döndürmedi.',
        color: 'red',
      });
      return;
    }

    editor.focus();
    let attachmentKey: string | null = null;
    editor.update(() => {
      const attachmentNode = $createFileAttachmentNode(
        trimmedUrl,
        fileName,
        mimeType,
        size,
      );
      attachmentKey = attachmentNode.getKey();
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([attachmentNode]);
      } else {
        $getRoot().append(attachmentNode);
      }
      logFileAttachmentInserted(fileName, mimeType);
    });
    if (attachmentKey) {
      persistFileAttachmentSelection(editor, attachmentKey);
    }
  };

  const handleImageFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = '';
    const uploaded = await onUploadImage(file);
    if (!uploaded) return;
    insertImage(uploaded.url, uploaded.altText);
    notifications.show({
      title: 'Image uploaded',
      message: `${file.name} inserted into document.`,
      color: 'teal',
    });
  };

  const handleDocumentFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = '';

    const validation = validateDocumentUploadFile(file);
    if (!validation.ok) {
      notifications.show({
        title: 'Geçersiz dosya',
        message: validation.message,
        color: 'red',
      });
      return;
    }

    const uploaded = await onUploadDocument(file);
    if (!uploaded) return;
    insertFileAttachment(uploaded.url, uploaded.fileName, uploaded.mimeType, uploaded.size);
    notifications.show({
      title: 'Doküman yüklendi',
      message: `${sanitizeFileDisplayName(uploaded.fileName)} eklendi.`,
      color: 'teal',
    });
  };

  const blockSelectValue =
    blockType === 'h1' || blockType === 'h2' || blockType === 'h3' || blockType === 'code'
      ? blockType
      : 'paragraph';

  return (
    <div className={editorShell.toolbarInner}>
      <div className={editorShell.toolbarControls}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleImageFileSelected(e);
          }}
        />
        <input
          ref={documentFileInputRef}
          type="file"
          accept={DOCUMENT_FILE_INPUT_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleDocumentFileSelected(e);
          }}
        />
        <Group className={editorShell.toolbarScroll} gap={8} wrap="nowrap" align="center">
          <Select
            className={editorShell.toolbarSelect}
            classNames={{
              input: editorShell.toolbarSelectInput,
              dropdown: editorShell.toolbarSelectDropdown,
              option: editorShell.toolbarSelectOption,
            }}
            size="xs"
            w={132}
            disabled={disabled}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true, zIndex: 500 }}
            value={blockSelectValue}
            onChange={handleBlockSelect}
            data={[
              { value: 'paragraph', label: 'Paragraf' },
              { value: 'h1', label: 'Başlık 1' },
              { value: 'h2', label: 'Başlık 2' },
              { value: 'h3', label: 'Başlık 3' },
              { value: 'code', label: 'Kod Bloğu' },
            ]}
          />

          <ToolbarDivider />

          <Group className={editorShell.toolbarGroup} gap={4} wrap="nowrap">
            <ToolbarIconButton
              label="Kalın"
              active={isBold}
              disabled={disabled}
              onClick={() => formatText('bold')}
            >
              <IconBold size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="İtalik"
              active={isItalic}
              disabled={disabled}
              onClick={() => formatText('italic')}
            >
              <IconItalic size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Altı çizili"
              active={isUnderline}
              disabled={disabled}
              onClick={() => formatText('underline')}
            >
              <IconUnderline size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Üstü çizili"
              active={isStrikethrough}
              disabled={disabled}
              onClick={() => formatText('strikethrough')}
            >
              <IconStrikethrough size={18} stroke={2} />
            </ToolbarIconButton>
          </Group>

          <ToolbarDivider />

          <Group className={editorShell.toolbarGroup} gap={4} wrap="nowrap">
            <ToolbarIconButton
              label="Satır içi kod"
              active={isCode}
              disabled={disabled}
              onClick={() => formatText('code')}
            >
              <IconCode size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Kod Bloğu"
              active={blockType === 'code'}
              disabled={disabled}
              onClick={applyCodeBlock}
            >
              <IconCodeDots size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarLinkButton
              disabled={disabled}
              active={isLink}
              editor={editor}
              lastSelectionRef={lastSelectionRef}
            />
            <ToolbarTableButton disabled={disabled} />
          </Group>

          <ToolbarDivider />

          <Group className={editorShell.toolbarGroup} gap={4} wrap="nowrap">
            <ToolbarIconButton
              label="Madde listesi"
              active={blockType === 'ul'}
              disabled={disabled}
              onClick={() => applyList('ul')}
            >
              <IconList size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Numaralı liste"
              active={blockType === 'ol'}
              disabled={disabled}
              onClick={() => applyList('ol')}
            >
              <IconListNumbers size={18} stroke={2} />
            </ToolbarIconButton>
          </Group>

          <ToolbarDivider />

          <Group className={editorShell.toolbarGroup} gap={4} wrap="nowrap">
            <ToolbarTextColorButton
              disabled={disabled}
              activeTextColor={activeTextColor}
              onActiveTextColorChange={setActiveTextColorBoth}
              editor={editor}
              lastSelectionRef={lastSelectionRef}
            />
            <ToolbarHighlightButton
              disabled={disabled}
              activeHighlightColor={activeHighlightColor}
              onActiveHighlightColorChange={setActiveHighlightColorBoth}
              editor={editor}
              lastSelectionRef={lastSelectionRef}
            />
          </Group>

          <ToolbarDivider />

          <Group className={editorShell.toolbarGroup} gap={4} wrap="nowrap">
            <ToolbarIconButton
              label="Geri al"
              disabled={disabled}
              onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
            >
              <IconArrowBackUp size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Yinele"
              disabled={disabled}
              onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
            >
              <IconArrowForwardUp size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton label="Biçimi temizle" disabled={disabled} onClick={clearFormatting}>
              <Text span className={editorShell.toolbarClearFmt} fw={700}>
                Tₓ
              </Text>
            </ToolbarIconButton>
            <ToolbarIconButton
              label={isUploadingMedia ? 'Yükleniyor…' : 'Görsel yükle'}
              disabled={disabled || isUploadingMedia}
              onClick={handleUploadButton}
            >
              <IconPhotoPlus size={18} stroke={2} />
            </ToolbarIconButton>
            <ToolbarIconButton
              label={isUploadingMedia ? 'Yükleniyor…' : 'Doküman yükle'}
              disabled={disabled || isUploadingMedia}
              onClick={handleDocumentUploadButton}
            >
              <IconPaperclip size={18} stroke={2} />
            </ToolbarIconButton>
          </Group>
        </Group>
      </div>
      {trailing}
    </div>
  );
}

export interface DocumentEditorShellProps {
  documentId: string;
  canEdit: boolean;
  initialContent?: unknown;
  documentTitle: string;
  onShareClick: () => void;
  shareDisabled?: boolean;
  memberAvatars?: DocumentEditorShellMemberAvatar[];
  /** When non-empty, overrides live SON AKTİVİTE; omit or [] for presence-only rows (UI-throttled ~1s). */
  presenceActivities?: DocumentEditorShellPresenceActivity[];
  commentsPanel?: ReactNode;
  messagesPanel?: ReactNode;
}

export function DocumentEditorShell({
  documentId,
  canEdit,
  initialContent,
  documentTitle,
  onShareClick,
  shareDisabled,
  memberAvatars,
  presenceActivities: presenceActivitiesProp,
  commentsPanel,
  messagesPanel,
}: DocumentEditorShellProps) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const authUser = useAuthStore((state) => state.user);
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const ytext = useMemo(() => ydoc.getText('content'), [ydoc]);
  const ylexicalState = useMemo(() => ydoc.getMap<string>('lexicalState'), [ydoc]);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [restorePayload, setRestorePayload] = useState<DocumentRestorePayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistStatus, setPersistStatus] = useState<PersistStatus>('idle');
  const [persistMessage, setPersistMessage] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [remoteCursorLayouts, setRemoteCursorLayouts] = useState<
    RemoteCursorOverlayLayout[]
  >([]);
  const [overlayRevision, setOverlayRevision] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [rightRailTab, setRightRailTab] = useState('users');
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);
  const [typingUsersById, setTypingUsersById] = useState<
    Map<string, DocumentMessageTypingUser>
  >(() => new Map());

  const rightRailTabRef = useRef(rightRailTab);
  const typingExpiryTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const presenceLiveSourceRef = useRef({
    activeUsers: [] as ActiveUser[],
    remoteCursors: [] as RemoteCursor[],
  });

  useEffect(() => {
    rightRailTabRef.current = rightRailTab;
  }, [rightRailTab]);

  useEffect(() => {
    if (rightRailTab === 'messages') {
      setMessagesUnreadCount(0);
    }
  }, [rightRailTab]);

  const activeUserIdSet = useMemo(
    () => new Set(activeUsers.map((user) => user.userId)),
    [activeUsers],
  );

  const typingUsers = useMemo(
    () => Array.from(typingUsersById.values()),
    [typingUsersById],
  );

  const emitDocumentMessageTyping = useCallback(
    (isTyping: boolean) => {
      socketRef.current?.emit('document_message_typing', { documentId, isTyping });
    },
    [documentId],
  );

  const messagesPanelRendered = useMemo(() => {
    if (!messagesPanel) return null;
    if (!isValidElement(messagesPanel)) return messagesPanel;
    return cloneElement(messagesPanel as ReactElement<DocumentMessagesPanelProps>, {
      activeUserIds: activeUserIdSet,
      typingUsers,
      onEmitTyping: emitDocumentMessageTyping,
    });
  }, [messagesPanel, activeUserIdSet, typingUsers, emitDocumentMessageTyping]);

  const editorRestoreCompleteRef = useRef(false);
  const hasRestoredNonEmptyContentRef = useRef(false);
  const restorePayloadRef = useRef<DocumentRestorePayload | null>(null);
  const restoreLifecycle = useMemo<RestoreLifecycleRefs>(
    () => ({
      restoreCompleteRef: editorRestoreCompleteRef,
      hasRestoredNonEmptyRef: hasRestoredNonEmptyContentRef,
      restorePayloadRef,
    }),
    [],
  );

  const pending = useRef<Uint8Array[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const stickyScrollSentinelRef = useRef<HTMLDivElement | null>(null);
  const stickyScrollStateRef = useRef({ page: false, canvas: false });
  const [stickyChromeScrolled, setStickyChromeScrolled] = useState(false);
  const initialContentRef = useRef<unknown>(initialContent);
  const lastComposerKeyRef = useRef<string | null>(null);
  const composerKey = `${documentId}-${canEdit ? 'edit' : 'view'}`;

  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [documentId, initialContent]);

  useEffect(() => {
    if (!hydrated) return;
    if (lastComposerKeyRef.current === composerKey) return;
    devRealtimeDebugLog('LexicalComposer mount/key change', {
      composerKey,
      prevKey: lastComposerKeyRef.current,
    });
    lastComposerKeyRef.current = composerKey;
  }, [hydrated, composerKey]);

  const syncStickyChromeScrolled = useCallback(() => {
    const { page, canvas } = stickyScrollStateRef.current;
    setStickyChromeScrolled(page || canvas);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const sentinel = stickyScrollSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        stickyScrollStateRef.current.page = !entry.isIntersecting;
        syncStickyChromeScrolled();
      },
      { threshold: [0, 1] },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hydrated, syncStickyChromeScrolled]);

  useEffect(() => {
    if (!hydrated) return;
    const canvas = editorContainerRef.current;
    if (!canvas) return;

    const onScroll = () => {
      stickyScrollStateRef.current.canvas = canvas.scrollTop > 6;
      syncStickyChromeScrolled();
    };

    onScroll();
    canvas.addEventListener('scroll', onScroll, { passive: true });
    return () => canvas.removeEventListener('scroll', onScroll);
  }, [hydrated, restorePayload, syncStickyChromeScrolled]);

  const lexicalInitialConfig = useMemo<InitialConfigType>(
    () => ({
      namespace: `flowdocs-document-${documentId}`,
      editable: canEdit,
      theme: EDITOR_THEME,
      nodes: [
        HeadingNode,
        ListNode,
        ListItemNode,
        CodeNode,
        CodeHighlightNode,
        LinkNode,
        FlowDocsTableNode,
        TableRowNode,
        TableCellNode,
        ImageNode,
        FileAttachmentNode,
      ],
      onError(error: Error) {
        throw error;
      },
    }),
    [canEdit, documentId],
  );

  useEffect(() => {
    let cancelled = false;

    setHydrated(false);
    setRestorePayload(null);
    setLoadError(null);
    setPersistStatus('idle');
    setPersistMessage(null);
    setActiveUsers([]);
    setRemoteCursors([]);
    setRemoteCursorLayouts([]);
    editorRestoreCompleteRef.current = false;
    hasRestoredNonEmptyContentRef.current = false;
    restorePayloadRef.current = null;
    pending.current = [];

    void (async () => {
      try {
        const state = await fetchDocumentState(documentId);
        if (cancelled) return;

        const persistedSerializedState =
          typeof state.editorStateJson === 'string' ? state.editorStateJson : '';
        const bytes = base64ToUint8(state.stateUpdateBase64);
        const previewFromState =
          typeof state.previewContent === 'string'
            ? normalizeFallbackPlainText(state.previewContent)
            : '';
        const previewFromDetail = normalizeFallbackPlainText(initialContentRef.current);
        const previewPlainText =
          previewFromState.length > 0 ? previewFromState : previewFromDetail;

        devRestoreDebugLog('state response', {
          hasStateUpdateBase64: bytes.length > 0,
          hasEditorStateJson: persistedSerializedState.length > 0,
          previewLength: previewPlainText.length,
          stateUpdateBase64Length: bytes.byteLength,
          editorStateJsonLength: persistedSerializedState.length,
        });

        if (bytes.length > 0) {
          devRestoreDebugLog('applying yjs restore');
          devRealtimeDebugLog('yjs applyUpdate called', {
            origin: 'load',
            bytes: bytes.byteLength,
          });
          Y.applyUpdate(ydoc, bytes, LOAD_ORIGIN);
          logYjsRestoreState(ytext, ylexicalState);
        }

        let yjsSerializedState = ylexicalState.get('serialized');
        const hasYjsRichSnapshot = hasRichLexicalSnapshot(yjsSerializedState);
        const hasApiRichSnapshot = hasRichLexicalSnapshot(persistedSerializedState);
        const apiHasCode = serializedContainsCodeFormat(persistedSerializedState);
        const yjsHasCode = serializedContainsCodeFormat(yjsSerializedState);
        const apiCodeBlockTextLen = getCodeBlockTextLengthFromSerialized(persistedSerializedState);
        const yjsCodeBlockTextLen = getCodeBlockTextLengthFromSerialized(yjsSerializedState);
        const shouldSeedEditorStateFromApi =
          hasApiRichSnapshot &&
          (!hasYjsRichSnapshot ||
            ytext.toString().trim().length === 0 ||
            (apiHasCode && !yjsHasCode) ||
            (apiCodeBlockTextLen > 0 && yjsCodeBlockTextLen < apiCodeBlockTextLen) ||
            (typeof yjsSerializedState === 'string' &&
              !yjsSerializedState.includes('"color"') &&
              persistedSerializedState.includes('"color"')));

        if (shouldSeedEditorStateFromApi) {
          devRestoreDebugLog('applying editorStateJson fallback');
          devRealtimeDebugLog('editorStateJson seed called');
          ydoc.transact(() => {
            ylexicalState.set(
            'serialized',
            normalizeSerializedCodeBlocks(persistedSerializedState),
          );
          }, LOAD_ORIGIN);
          yjsSerializedState = persistedSerializedState;
        } else if (
          !hasYjsRichSnapshot &&
          persistedSerializedState.trim().length > 0 &&
          ytext.toString().length === 0
        ) {
          const plainFromApi = normalizeFallbackPlainText(persistedSerializedState);
          if (plainFromApi.length > 0) {
            devRestoreDebugLog('applying editorStateJson fallback', { mode: 'plain-text' });
            ydoc.transact(() => {
              replaceYTextValue(ytext, plainFromApi);
            }, LOAD_ORIGIN);
          }
        }

        const serializedState = ylexicalState.get('serialized');
        const hasLexicalSerializedState = hasRichLexicalSnapshot(serializedState);

        if (!hasLexicalSerializedState && ytext.toString().length === 0) {
          if (previewPlainText.length > 0) {
            devRestoreDebugLog('applying previewContent fallback', {
              textLen: previewPlainText.length,
            });
            ydoc.transact(() => {
              replaceYTextValue(ytext, previewPlainText);
            }, LOAD_ORIGIN);
          }
        }

        logYjsRestoreState(ytext, ylexicalState);
        if (serializedContainsCodeFormat(ylexicalState.get('serialized'))) {
          logSerializedContainsCode(ylexicalState.get('serialized') ?? '');
        }
        logSerializedContainsCodeBlock(ylexicalState.get('serialized') ?? '', { force: true });

        const yjsPlainAfterRestore = ytext.toString().trim();
        const yjsSerializedAfterRestore = ylexicalState.get('serialized');
        const allowEmptyPublish =
          yjsPlainAfterRestore.length === 0 &&
          !hasRichLexicalSnapshot(yjsSerializedAfterRestore) &&
          persistedSerializedState.trim().length === 0 &&
          previewPlainText.length === 0;

        if (cancelled) return;
        const payload: DocumentRestorePayload = {
          editorStateJson: persistedSerializedState,
          previewPlainText,
          allowEmptyPublish,
        };
        restorePayloadRef.current = payload;
        setRestorePayload(payload);
        setHydrated(true);
      } catch (err) {
        if (cancelled) return;
        setLoadError(getApiErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, ydoc, ylexicalState, ytext]);

  const handleUploadImage = useCallback(
    async (file: File): Promise<{ url: string; altText: string } | null> => {
      if (!canEdit) {
        notifications.show({
          title: 'Not allowed',
          message: 'You cannot upload media in view-only mode.',
          color: 'orange',
        });
        return null;
      }

      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 5 * 1024 * 1024
      ) {
        notifications.show({
          title: 'Invalid file',
          message: 'Only PNG, JPEG, WEBP files up to 5MB are allowed.',
          color: 'red',
        });
        return null;
      }

      setIsUploadingImage(true);
      try {
        const presign = await createDocumentMediaPresign(documentId, {
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        });

        const putResponse = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!putResponse.ok) {
          throw new Error(`Upload failed with status ${putResponse.status}`);
        }

        const confirm = await confirmDocumentMediaUpload(documentId, {
          objectKey: presign.objectKey,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        });

        const imageUrl = resolveConfirmMediaUrl(confirm);
        if (!imageUrl) {
          notifications.show({
            title: 'Image upload incomplete',
            message:
              'The server did not return an image URL. Upload may have succeeded but the image cannot be embedded.',
            color: 'red',
          });
          return null;
        }

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- dev-only media pipeline debug
          console.log('[media] resolved image url', imageUrl);
        }

        return { url: imageUrl, altText: file.name };
      } catch (err) {
        notifications.show({
          title: 'Image upload failed',
          message: getApiErrorMessage(err),
          color: 'red',
        });
        return null;
      } finally {
        setIsUploadingImage(false);
      }
    },
    [canEdit, documentId],
  );

  const handleUploadDocument = useCallback(
    async (
      file: File,
    ): Promise<{ url: string; fileName: string; mimeType: string; size: number } | null> => {
      if (!canEdit) {
        notifications.show({
          title: 'İzin yok',
          message: 'Salt okunur modda dosya yükleyemezsiniz.',
          color: 'orange',
        });
        return null;
      }

      const validation = validateDocumentUploadFile(file);
      if (!validation.ok) {
        notifications.show({
          title: 'Geçersiz dosya',
          message: validation.message,
          color: 'red',
        });
        return null;
      }

      setIsUploadingDocument(true);
      try {
        const safeName = sanitizeFileDisplayName(file.name);
        const presign = await createDocumentMediaPresign(documentId, {
          fileName: safeName,
          contentType: file.type,
          size: file.size,
        });

        const putResponse = await fetch(presign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!putResponse.ok) {
          throw new Error(`Upload failed with status ${putResponse.status}`);
        }

        const confirm = await confirmDocumentMediaUpload(documentId, {
          objectKey: presign.objectKey,
          fileName: safeName,
          contentType: file.type,
          size: file.size,
        });

        const fileUrl = resolveConfirmMediaUrl(confirm);
        if (!fileUrl) {
          notifications.show({
            title: 'Yükleme tamamlanamadı',
            message: 'Sunucu dosya adresi döndürmedi.',
            color: 'red',
          });
          return null;
        }

        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- dev-only media pipeline debug
          console.log('[media] resolved document url', fileUrl);
        }

        return {
          url: fileUrl,
          fileName: safeName,
          mimeType: file.type,
          size: file.size,
        };
      } catch (err) {
        notifications.show({
          title: 'Doküman yüklenemedi',
          message: getApiErrorMessage(err),
          color: 'red',
        });
        return null;
      } finally {
        setIsUploadingDocument(false);
      }
    },
    [canEdit, documentId],
  );

  const flushPending = useCallback(async () => {
    if (pending.current.length === 0) return;
    if (!editorRestoreCompleteRef.current) {
      devRestoreDebugLog('blocked flush before restore');
      pending.current = [];
      return;
    }

    const merged = mergePendingUpdates(pending.current);
    pending.current = [];

    const serializedState = ylexicalState.get('serialized');
    const payload = restorePayloadRef.current;
    const serializedForGuard =
      typeof serializedState === 'string' ? serializedState : '';
    const plainFromYjs = ytext.toString();
    const persistGuard: PersistGuardContext = {
      allowEmptyPublish: payload?.allowEmptyPublish ?? false,
      editorStateJson: payload?.editorStateJson ?? '',
      previewPlainText: payload?.previewPlainText ?? '',
      hasRestoredNonEmpty: hasRestoredNonEmptyContentRef.current,
    };
    const flushBlock = shouldBlockDestructiveEmptyPublish(
      plainFromYjs,
      serializedForGuard,
      ytext,
      ylexicalState,
      persistGuard,
    );
    if (flushBlock.block) {
      devRestoreDebugLog('blocked destructive empty publish', {
        reason: flushBlock.reason,
        phase: 'flush',
      });
      return;
    }
    if (!yjsHasSubstantiveContent(ytext, ylexicalState)) {
      return;
    }

    setPersistStatus('saving');
    setPersistMessage(null);

    try {
      let normalizedSerializedState: string | undefined;
      if (
        typeof serializedState === 'string' &&
        serializedState.length > 0 &&
        isValidSerializedLexicalState(serializedState)
      ) {
        const candidate = normalizeSerializedCodeBlocks(serializedState);
        try {
          JSON.parse(candidate);
          normalizedSerializedState = candidate;
        } catch {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console -- dev-only persist guard
            console.warn('[persist-debug] skipped invalid editorStateJson after normalize');
          }
        }
      }

      await postDocumentUpdate(documentId, {
        updateBase64: uint8ToBase64(merged),
        sourceClientId: String(ydoc.clientID),
        ...(normalizedSerializedState
          ? { editorStateJson: normalizedSerializedState }
          : {}),
      });

      devRealtimeDebugLog('document update sent', {
        updateBase64Length: uint8ToBase64(merged).length,
        yjsBytes: merged.byteLength,
        hasEditorStateJson: Boolean(normalizedSerializedState),
        editorStateJsonLength: normalizedSerializedState?.length ?? 0,
        socketEvent: 'document_update',
        note: 'HTTP persist → server socket broadcast',
      });
      setPersistStatus('saved');
    } catch (err) {
      setPersistStatus('error');
      setPersistMessage(getApiErrorMessage(err));
    }
  }, [documentId, ydoc, ylexicalState, ytext]);

  useEffect(() => {
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      setOverlayRevision((v) => v + 1);
      const originName =
        origin === LOAD_ORIGIN
          ? 'load'
          : origin === REMOTE_ORIGIN
            ? 'remote'
            : origin === EDITOR_ORIGIN
              ? 'editor'
              : String(origin ?? 'unknown');
      devRealtimeDebugLog('ydoc.on(update)', {
        origin: originName,
        bytes: update.byteLength,
      });
      if (origin === LOAD_ORIGIN || origin === REMOTE_ORIGIN) return;
      if (!canEdit) return;
      if (!editorRestoreCompleteRef.current) {
        devRestoreDebugLog('blocked flush before restore');
        return;
      }

      pending.current.push(update);

      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
      }

      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        void flushPending();
      }, 400);
    };

    ydoc.on('update', onUpdate);

    return () => {
      ydoc.off('update', onUpdate);

      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }

      if (editorRestoreCompleteRef.current) {
        void flushPending();
      } else {
        pending.current = [];
        devRestoreDebugLog('blocked flush before restore', { phase: 'unmount' });
      }
    };
  }, [canEdit, flushPending, ydoc]);

  const recalculateRemoteCursorLayouts = useCallback(() => {
    const container = editorContainerRef.current;
    const editable = getEditableElementForDocument(documentId);
    if (!container || !editable || remoteCursors.length === 0) {
      setRemoteCursorLayouts([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nextLayouts: RemoteCursorOverlayLayout[] = [];

    for (const cursor of remoteCursors) {
      const caretRange = createCollapsedRangeFromTextOffset(
        editable,
        cursor.focusOffset,
      );
      if (!caretRange) {
        continue;
      }

      const caretRect =
        caretRange.getBoundingClientRect().height > 0
          ? caretRange.getBoundingClientRect()
          : caretRange.getClientRects()[0];
      if (!caretRect) {
        continue;
      }

      let selectionRect: CursorSelectionOverlayRect | null = null;
      if (cursor.anchorOffset !== cursor.focusOffset) {
        const startOffset = Math.min(cursor.anchorOffset, cursor.focusOffset);
        const endOffset = Math.max(cursor.anchorOffset, cursor.focusOffset);
        const selectionRange = createRangeBetweenTextOffsets(
          editable,
          startOffset,
          endOffset,
        );
        if (selectionRange) {
          const rects = [...selectionRange.getClientRects()];
          if (rects.length > 0) {
            const firstRect = rects[0]!;
            const lastRect = rects[rects.length - 1]!;
            if (Math.abs(firstRect.top - lastRect.top) < 3) {
              selectionRect = {
                top: firstRect.top - containerRect.top,
                left: firstRect.left - containerRect.left,
                width: Math.max(1, lastRect.right - firstRect.left),
                height: Math.max(2, firstRect.height),
              };
            }
          }
        }
      }

      nextLayouts.push({
        userId: cursor.userId,
        fullName: cursor.fullName,
        color: cursor.color,
        caretTop: caretRect.top - containerRect.top,
        caretLeft: caretRect.left - containerRect.left,
        caretHeight: Math.max(14, caretRect.height || 16),
        selectionRect,
      });
    }

    setRemoteCursorLayouts(nextLayouts);
  }, [documentId, remoteCursors]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      recalculateRemoteCursorLayouts();
    });
    return () => cancelAnimationFrame(raf);
  }, [
    recalculateRemoteCursorLayouts,
    remoteCursors,
    overlayRevision,
  ]);

  useEffect(() => {
    const handlePositionRecalc = () => {
      recalculateRemoteCursorLayouts();
    };

    const container = editorContainerRef.current;
    const editable = getEditableElementForDocument(documentId);

    window.addEventListener('resize', handlePositionRecalc);
    container?.addEventListener('scroll', handlePositionRecalc, {
      passive: true,
    });
    editable?.addEventListener('scroll', handlePositionRecalc, {
      passive: true,
    });

    return () => {
      window.removeEventListener('resize', handlePositionRecalc);
      container?.removeEventListener('scroll', handlePositionRecalc);
      editable?.removeEventListener('scroll', handlePositionRecalc);
    };
  }, [documentId, recalculateRemoteCursorLayouts]);

  const emitCursorUpdate = useCallback(
    (anchorOffset: number, focusOffset: number) => {
      if (!socketRef.current || !authUser) {
        return;
      }

      socketRef.current.emit('cursor_update', {
        documentId,
        userId: authUser.id,
        fullName: authUser.fullName,
        color: getUserColor(authUser.id),
        anchorOffset: Math.max(0, Math.floor(anchorOffset)),
        focusOffset: Math.max(0, Math.floor(focusOffset)),
        updatedAt: new Date().toISOString(),
      });
    },
    [authUser, documentId],
  );

  const scheduleCursorUpdate = useCallback(
    (anchorOffset: number, focusOffset: number) => {
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
      }
      cursorTimerRef.current = setTimeout(() => {
        cursorTimerRef.current = null;
        emitCursorUpdate(anchorOffset, focusOffset);
      }, 300);
    },
    [emitCursorUpdate],
  );

  useEffect(() => {
    const getSelectionOffset = (node: Node, offset: number): number => {
      const editable = document.querySelector(
        `[contenteditable][data-document-id="${documentId}"]`,
      );
      if (!(editable instanceof HTMLElement)) {
        return 0;
      }

      const selectionRange = document.createRange();
      selectionRange.selectNodeContents(editable);
      selectionRange.setEnd(node, offset);
      return selectionRange.toString().length;
    };

    const onSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const anchorNode = selection.anchorNode;
      const focusNode = selection.focusNode;
      if (!anchorNode || !focusNode) return;

      const editable = document.querySelector(
        `[contenteditable][data-document-id="${documentId}"]`,
      );
      if (!(editable instanceof HTMLElement)) return;
      if (!editable.contains(anchorNode) || !editable.contains(focusNode)) return;

      const anchorOffset = getSelectionOffset(anchorNode, selection.anchorOffset);
      const focusOffset = getSelectionOffset(focusNode, selection.focusOffset);
      scheduleCursorUpdate(anchorOffset, focusOffset);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      if (cursorTimerRef.current) {
        clearTimeout(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
    };
  }, [documentId, scheduleCursorUpdate]);

  useEffect(() => {
    console.log('[realtime] accessToken exists:', Boolean(accessToken));
    console.log('[realtime] base url:', getRealtimeBaseUrl());
    console.log('[realtime] documentId:', documentId);

    if (!accessToken) {
      console.warn('[realtime] socket skipped: missing access token');
      return;
    }

    const socket: Socket = io(`${getRealtimeBaseUrl()}/realtime`, {
      transports: ['websocket', 'polling'],
      auth: {
        token: `Bearer ${accessToken}`,
      },
    });

    socket.on('connect', () => {
      console.log('[realtime] connected:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('[realtime] connect_error:', error.message, error);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[realtime] disconnected:', reason);
    });

    const handlePresence = (event: DocumentPresenceEvent) => {
      console.log('[realtime] document_presence:', event);

      if (event.documentId !== documentId) return;
      setActiveUsers(event.activeUsers);
    };

    const handleDocumentUpdate = (event: DocumentUpdateEvent) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- dev-only realtime tracing
        console.log('[realtime] document_update:', event);
      }

      if (event.documentId !== documentId) return;
      if (
        event.sourceClientId &&
        event.sourceClientId === String(ydoc.clientID)
      ) {
        devRealtimeDebugLog('remote update skipped', { reason: 'own-sourceClientId' });
        return;
      }

      try {
        const bytes = base64ToUint8(event.updateBase64);
        if (bytes.length === 0) return;
        devRealtimeDebugLog('remote update received', {
          updateBase64Length: event.updateBase64.length,
          bytes: bytes.byteLength,
          hasEditorStateJson: typeof event.editorStateJson === 'string',
          editorStateJsonLength:
            typeof event.editorStateJson === 'string'
              ? event.editorStateJson.length
              : 0,
        });
        devRealtimeDebugLog('yjs applyUpdate called', {
          origin: 'remote',
          bytes: bytes.byteLength,
        });
        Y.applyUpdate(ydoc, bytes, REMOTE_ORIGIN);

        if (
          typeof event.editorStateJson === 'string' &&
          event.editorStateJson.length > 0 &&
          isValidSerializedLexicalState(event.editorStateJson)
        ) {
          const normalizedRemote = normalizeSerializedCodeBlocks(event.editorStateJson);
          ydoc.transact(() => {
            ylexicalState.set('serialized', normalizedRemote);
          }, REMOTE_ORIGIN);
          devRealtimeDebugLog('remote editorStateJson seeded to ylexicalState', {
            serializedLen: normalizedRemote.length,
          });
        }
      } catch (error) {
        devRealtimeDebugLog('remote update apply failed', {
          message: error instanceof Error ? error.message : String(error),
        });
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- dev-only realtime tracing
          console.warn('[realtime] ignored malformed realtime payload', error);
        }
      }
    };

    const handleDocumentCursor = (event: DocumentCursorEvent) => {
      if (event.documentId !== documentId) return;
      setRemoteCursors(
        event.cursors.filter((cursor) => cursor.userId !== authUser?.id),
      );
    };

    const handleDocumentMemberUpdated = (event: DocumentMemberUpdatedEvent) => {
      if (event.documentId !== documentId) return;
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.detail(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.members(documentId),
      });
      void queryClient.invalidateQueries({
        queryKey: documentsQueryKeys.list(),
      });
    };

    const clearTypingUser = (userId: string) => {
      const timer = typingExpiryTimersRef.current.get(userId);
      if (timer) {
        clearTimeout(timer);
        typingExpiryTimersRef.current.delete(userId);
      }
      setTypingUsersById((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    const scheduleTypingExpiry = (userId: string) => {
      const existing = typingExpiryTimersRef.current.get(userId);
      if (existing) clearTimeout(existing);
      typingExpiryTimersRef.current.set(
        userId,
        setTimeout(() => {
          typingExpiryTimersRef.current.delete(userId);
          setTypingUsersById((prev) => {
            if (!prev.has(userId)) return prev;
            const next = new Map(prev);
            next.delete(userId);
            return next;
          });
        }, 3500),
      );
    };

    const handleDocumentMessageCreated = (event: DocumentMessageCreatedEvent) => {
      if (event.documentId !== documentId) return;
      upsertDocumentMessageInCache(
        queryClient,
        documentId,
        event.message as DocumentMessage,
        authUser?.id,
      );

      const authorId = event.message.author.id;
      const isOwnMessage =
        authorId === authUser?.id || event.message.isMine === true;
      if (!isOwnMessage && rightRailTabRef.current !== 'messages') {
        setMessagesUnreadCount((count) => count + 1);
      }

      clearTypingUser(authorId);
    };

    const handleDocumentMessageDeleted = (event: DocumentMessageDeletedEvent) => {
      if (event.documentId !== documentId) return;
      removeDocumentMessageFromCache(queryClient, documentId, event.messageId);
    };

    const handleDocumentMessageTyping = (event: DocumentMessageTypingEvent) => {
      if (event.documentId !== documentId) return;
      if (event.user.id === authUser?.id) return;

      const userId = event.user.id;
      if (event.isTyping) {
        setTypingUsersById((prev) => {
          const next = new Map(prev);
          next.set(userId, event.user);
          return next;
        });
        scheduleTypingExpiry(userId);
        return;
      }

      clearTypingUser(userId);
    };

    const joinRoom = () => {
      console.log('[realtime] emitting join_document:', documentId);

      socket.emit(
        'join_document',
        { documentId },
        (response?: { ok?: boolean; activeUsers?: ActiveUser[] }) => {
          console.log('[realtime] join_document response:', response);

          if (response?.ok && Array.isArray(response.activeUsers)) {
            setActiveUsers(response.activeUsers);
          }
        },
      );
    };

    socket.on('connect', joinRoom);
    socket.on('document_presence', handlePresence);
    socket.on('document_update', handleDocumentUpdate);
    socket.on('document_cursor', handleDocumentCursor);
    socket.on('document_member_updated', handleDocumentMemberUpdated);
    socket.on('document_message_created', handleDocumentMessageCreated);
    socket.on('document_message_deleted', handleDocumentMessageDeleted);
    socket.on('document_message_typing', handleDocumentMessageTyping);
    socketRef.current = socket;

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      console.log('[realtime] leaving document:', documentId);

      socket.emit('leave_document', { documentId });
      socket.off('connect', joinRoom);
      socket.off('document_presence', handlePresence);
      socket.off('document_update', handleDocumentUpdate);
      socket.off('document_cursor', handleDocumentCursor);
      socket.off('document_member_updated', handleDocumentMemberUpdated);
      socket.off('document_message_created', handleDocumentMessageCreated);
      socket.off('document_message_deleted', handleDocumentMessageDeleted);
      socket.off('document_message_typing', handleDocumentMessageTyping);
      typingExpiryTimersRef.current.forEach((timer) => clearTimeout(timer));
      typingExpiryTimersRef.current.clear();
      setTypingUsersById(new Map());
      socketRef.current = null;
      socket.disconnect();
    };
  }, [accessToken, authUser?.id, documentId, queryClient, ydoc, ylexicalState]);

  const syncToolbarTrailing = useMemo(
    () => (
      <Group gap="xs" wrap="nowrap" align="center" className={editorShell.syncBadge}>
        <Badge
          variant="light"
          size="sm"
          styles={{
            root: {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: '0.03em',
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundColor:
                persistStatus === 'error'
                  ? 'rgba(255,80,80,0.12)'
                  : persistStatus === 'saving'
                    ? 'rgba(240,160,64,0.12)'
                    : 'rgba(62,207,142,0.14)',
              color:
                persistStatus === 'error'
                  ? '#ff6b6b'
                  : persistStatus === 'saving'
                    ? '#f0a040'
                    : '#3ecf8e',
            },
          }}
        >
          {persistStatus === 'saving'
            ? 'Senkronize…'
            : persistStatus === 'error'
              ? 'Çevrimdışı'
              : 'Senkronize'}
        </Badge>
        {!canEdit ? (
          <Badge size="xs" variant="light" color="orange">
            Salt okunur
          </Badge>
        ) : null}
      </Group>
    ),
    [canEdit, persistStatus],
  );

  const statusSyncToneClass =
    persistStatus === 'error'
      ? editorShell.statusSyncErr
      : persistStatus === 'saving'
        ? editorShell.statusSyncWarn
        : editorShell.statusSyncOk;

  const statusSyncLabel =
    persistStatus === 'saving'
      ? 'Senkronize…'
      : persistStatus === 'error'
        ? 'Çevrimdışı'
        : 'Senkronize';

  const presenceRailRows = useMemo(
    () =>
      activeUsers.length > 0
        ? activeUsers.map((u, i) => ({
            key: u.userId,
            userId: u.userId,
            fullName: u.fullName,
            origin: 'session' as const,
            index: i,
          }))
        : (memberAvatars ?? []).slice(0, 8).map((m, i) => ({
            key: m.userId,
            userId: m.userId,
            fullName: m.fullName,
            origin: 'member' as const,
            index: i,
          })),
    [activeUsers, memberAvatars],
  );

  presenceLiveSourceRef.current = { activeUsers, remoteCursors };

  if (loadError) {
    return (
      <Alert color="red" title="Editor could not load">
        {loadError}
      </Alert>
    );
  }

  if (!hydrated || !restorePayload) {
    return (
      <Text size="sm" style={{ color: '#6b6f85' }}>
        Loading document state...
      </Text>
    );
  }

  return (
    <Box className={editorShell.root}>
      <LexicalComposer
        key={composerKey}
        initialConfig={lexicalInitialConfig}
      >
        <DocumentEditorCapabilitiesProvider canEdit={canEdit}>
          <Box className={editorShell.workspaceInner}>
            <div
              ref={stickyScrollSentinelRef}
              className={editorShell.editorStickySentinel}
              aria-hidden
            />

            <div
              className={`${editorShell.editorStickyShell} flowdocs-editor-sticky-shell${
                stickyChromeScrolled ? ` ${editorShell.editorStickyShellScrolled}` : ''
              }`}
            >
              <div className={`${editorShell.editorTopbar} flowdocs-editor-topbar`}>
                <Box className={editorShell.docChromeBar}>
              <Box style={{ flex: 1, minWidth: 0 }} aria-hidden />
              <Group gap={8} wrap="nowrap" align="center" justify="center" style={{ flex: '0 1 auto' }}>
                <Text size="xs" style={{ color: '#6b6f85', flexShrink: 0 }}>
                  FlowDocs
                </Text>
                <Text size="xs" style={{ color: '#6b6f85' }}>
                  /
                </Text>
                <Text className={editorShell.docChromeTitle} lineClamp={1} style={{ fontSize: 13 }}>
                  {documentTitle}
                </Text>
              </Group>
              <Group gap="md" wrap="nowrap" justify="flex-end" style={{ flex: 1, minWidth: 0 }}>
                <Avatar.Group spacing={-10}>
                  {activeUsers.length > 0
                    ? activeUsers.slice(0, 6).map((user) => (
                        <Indicator
                          key={user.userId}
                          inline
                          position="bottom-end"
                          offset={4}
                          size={10}
                          color="teal"
                          withBorder
                          zIndex={2}
                        >
                          <Avatar
                            radius="xl"
                            size="md"
                            color={getUserColor(user.userId)}
                            styles={{ root: { border: '2px solid #1a1d27' } }}
                          >
                            {initialsFromName(user.fullName)}
                          </Avatar>
                        </Indicator>
                      ))
                    : (memberAvatars ?? []).slice(0, 5).map((member) => (
                        <Avatar
                          key={member.userId}
                          radius="xl"
                          size="md"
                          src={member.avatarUrl ?? undefined}
                          color="gray"
                          styles={{
                            root: {
                              border: '2px solid #1a1d27',
                              opacity: 0.5,
                            },
                          }}
                        >
                          {initialsFromName(member.fullName)}
                        </Avatar>
                      ))}
                </Avatar.Group>
                <Button
                  size="compact-sm"
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => setExportModalOpen(true)}
                >
                  Dışarı Aktar
                </Button>
                <Button
                  size="compact-sm"
                  variant="light"
                  onClick={onShareClick}
                  disabled={shareDisabled}
                >
                  Paylaş
                </Button>
              </Group>
                </Box>
              </div>

              <DocumentExportModal
              opened={exportModalOpen}
              onClose={() => setExportModalOpen(false)}
              documentId={documentId}
            />

              {persistMessage ? (
                <Box className={editorShell.editorStickyPersist} px="md" py={6}>
                  <Text size="xs" c="red">
                    {persistMessage}
                  </Text>
                </Box>
              ) : null}

              <div className={`${editorShell.editorToolbar} flowdocs-editor-toolbar`}>
                <div className={editorShell.toolbarStrip}>
                  <EditorToolbarPlugin
                    disabled={!canEdit}
                    isUploadingImage={isUploadingImage}
                    isUploadingDocument={isUploadingDocument}
                    onUploadImage={handleUploadImage}
                    onUploadDocument={handleUploadDocument}
                    trailing={syncToolbarTrailing}
                  />
                </div>
              </div>
            </div>

            <div className={editorShell.bodyThreeCol}>
              <aside className={editorShell.leftOutline}>
                <div className={editorShell.outlineHeader}>İÇİNDEKİLER</div>
                <DocumentOutlinePanel scrollContainerRef={editorContainerRef} />
              </aside>

              <div className={editorShell.centerColumn}>
                <Box className={editorShell.centerCanvasStack}>
                  <div ref={editorContainerRef} className={editorShell.canvasWorkbench}>
                    <div className={`${editorShell.documentPage} flowdocs-document-page`}>
                      <div className={editorShell.editorBlock}>
                        <RichTextPlugin
                          contentEditable={
                            <ContentEditable
                              contentEditable={canEdit}
                              aria-readonly={!canEdit}
                              data-document-id={documentId}
                              className="flowdocs-editor-content"
                              style={{
                                minHeight: 280,
                                outline: 'none',
                                whiteSpace: 'pre-wrap',
                                opacity: canEdit ? 1 : 0.85,
                              }}
                            />
                          }
                          placeholder={null}
                          ErrorBoundary={LexicalErrorBoundary}
                        />
                        <ListPlugin />
                        <FlowDocsLinkPlugin />
                        <LinkClickPlugin />
                        <FlowDocsTablePlugin />
                      </div>
                    </div>
                    <div className={editorShell.editorFloatingChrome}>
                      <TableFloatingToolbar anchorRef={editorContainerRef} />
                      <FileAttachmentFloatingToolbar anchorRef={editorContainerRef} />
                    </div>
                  </div>
                  <Box className={editorShell.cursorOverlayLayer}>
                    {remoteCursorLayouts.map((cursor) => (
                      <Box key={cursor.userId}>
                        {cursor.selectionRect ? (
                          <Box
                            style={{
                              position: 'absolute',
                              left: cursor.selectionRect.left,
                              top: cursor.selectionRect.top,
                              width: cursor.selectionRect.width,
                              height: cursor.selectionRect.height,
                              backgroundColor: cursor.color,
                              opacity: 0.2,
                              borderRadius: 2,
                            }}
                          />
                        ) : null}
                        <Box
                          style={{
                            position: 'absolute',
                            left: cursor.caretLeft,
                            top: cursor.caretTop,
                            width: 2,
                            height: cursor.caretHeight,
                            backgroundColor: cursor.color,
                            borderRadius: 2,
                          }}
                        />
                        <Box
                          style={{
                            position: 'absolute',
                            left: cursor.caretLeft + 4,
                            top: cursor.caretTop - 16,
                            backgroundColor: cursor.color,
                            color: '#fff',
                            fontSize: 10,
                            lineHeight: 1.2,
                            padding: '1px 6px',
                            borderRadius: 10,
                            whiteSpace: 'nowrap',
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cursor.fullName}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </div>

              <aside className={`${editorShell.rightRail} flowdocs-editor-right-rail`}>
                <Tabs
                  value={rightRailTab}
                  onChange={(value) => {
                    if (value) setRightRailTab(value);
                  }}
                  className={editorShell.railTabs}
                  keepMounted={false}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                >
                  <Tabs.List grow>
                    <Tabs.Tab value="users">Kullanıcılar</Tabs.Tab>
                    <Tabs.Tab value="comments">Yorumlar</Tabs.Tab>
                    <Tabs.Tab value="messages">
                      <span className={editorShell.messagesTabLabel}>
                        Mesajlar
                        {messagesUnreadCount > 0 ? (
                          <span
                            className={editorShell.messagesTabBadge}
                            aria-label={`${messagesUnreadCount} okunmamış mesaj`}
                          >
                            {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                          </span>
                        ) : null}
                      </span>
                    </Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel value="users" pt={0} className={editorShell.railPanel}>
                    <ScrollArea
                      h="100%"
                      scrollbarSize={6}
                      type="auto"
                      classNames={{
                        root: `${editorShell.railUsersScroll} ${editorShell.railScrollRoot}`,
                        viewport: `${editorShell.railUsersViewport} ${editorShell.railScrollViewport}`,
                        content: editorShell.railScrollContent,
                        thumb: editorShell.railScrollThumb,
                      }}
                    >
                      <Stack gap={0} className={editorShell.railUsersBody}>
                        <Text className={editorShell.presenceSectionLabel}>
                          ŞU AN AKTİF — {activeUsers.length}
                        </Text>

                        {presenceRailRows.length === 0 ? (
                          <Text size="sm" className={editorShell.muted} mb="lg">
                            Bu dokümanda aktif kullanıcı yok.
                          </Text>
                        ) : (
                          <Stack gap={0} mb="lg">
                            {presenceRailRows.map((row) => {
                              const hint = cursorHintFromRemote(row.userId, remoteCursors);
                              const cursorLine =
                                hint ??
                                (row.origin === 'session' ? '↳ Konum senkronize ediliyor' : null);
                              const statusLabel =
                                row.origin === 'session'
                                  ? PRESENCE_STATUS_ACTIVE[row.index % PRESENCE_STATUS_ACTIVE.length]
                                  : 'Katılımcı';
                              const dot = presenceDotColor(row.index);
                              return (
                                <Box key={row.key} className={editorShell.presenceUserCard}>
                                  <Group
                                    wrap="nowrap"
                                    align="center"
                                    gap={12}
                                    justify="space-between"
                                    className={editorShell.presenceUserCardInner}
                                  >
                                    <Box
                                      className={editorShell.presenceAvatarLg}
                                      style={{ background: presenceGradientCss(row.index) }}
                                      aria-hidden
                                    >
                                      {initialsFromName(row.fullName)}
                                    </Box>
                                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                      <Text fw={700} size="sm" c="#e8eaf5" truncate>
                                        {row.fullName}
                                      </Text>
                                      <Text size="xs" className={editorShell.presenceMuted}>
                                        {statusLabel}
                                      </Text>
                                      {cursorLine ? (
                                        <Text size="xs" className={editorShell.presenceCursorHint}>
                                          {cursorLine}
                                        </Text>
                                      ) : null}
                                    </Stack>
                                    <Box
                                      className={editorShell.presenceStatusDot}
                                      style={{
                                        backgroundColor: dot,
                                        boxShadow: `0 0 6px ${dot}99`,
                                      }}
                                      aria-hidden
                                    />
                                  </Group>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}

                        <PresenceActivityFeed
                          presenceActivitiesProp={presenceActivitiesProp}
                          presenceLiveSourceRef={presenceLiveSourceRef}
                        />
                      </Stack>
                    </ScrollArea>
                  </Tabs.Panel>
                  <Tabs.Panel value="comments" pt={0} className={editorShell.railPanel}>
                    <ScrollArea
                      h="100%"
                      scrollbarSize={6}
                      type="auto"
                      classNames={{
                        root: editorShell.railScrollRoot,
                        viewport: editorShell.railScrollViewport,
                        content: editorShell.railScrollContent,
                      }}
                    >
                      <Box className={editorShell.commentsTabBody}>
                        {commentsPanel ?? (
                          <Text size="sm" className={editorShell.muted}>
                            Yorumlar bu sekmede gösterilecek.
                          </Text>
                        )}
                      </Box>
                    </ScrollArea>
                  </Tabs.Panel>
                  <Tabs.Panel value="messages" pt={0} className={editorShell.railPanel}>
                    {messagesPanelRendered ?? messagesPanel ?? (
                      <Text size="sm" className={editorShell.muted} p="md">
                        Mesajlar bu sekmede gösterilecek.
                      </Text>
                    )}
                  </Tabs.Panel>
                </Tabs>
              </aside>
            </div>

            <HistoryPlugin />
            <YjsLexicalBridgePlugin
              ydoc={ydoc}
              ytext={ytext}
              ylexicalState={ylexicalState}
              canEdit={canEdit}
              restorePayload={restorePayload}
              restoreLifecycle={restoreLifecycle}
            />
            <CommentSelectionCapturePlugin documentId={documentId} />
            <ImageClipboardPlugin />
            <ImageDragDropPlugin />
            <FileAttachmentSelectionPlugin />

            <footer className={editorShell.statusBar}>
              <Text component="span">Satır — · Sütun —</Text>
              <Text component="span" style={{ flex: 1, textAlign: 'center' }} truncate>
                Kelime — · Karakter — · TR
              </Text>
              <Text component="span" className={statusSyncToneClass}>
                ● {activeUsers.length} kullanıcı · {statusSyncLabel}
              </Text>
            </footer>
          </Box>
        </DocumentEditorCapabilitiesProvider>
      </LexicalComposer>
    </Box>
  );

}
