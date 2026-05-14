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
  Select,
  Stack,
  Tabs,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
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
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
import { resolveConfirmMediaUrl } from '../utils/confirm-media-url';
import { CommentSelectionCapturePlugin } from './CommentSelectionCapturePlugin';
import { DocumentEditorCapabilitiesProvider } from './DocumentEditorCapabilitiesContext';
import { ImageClipboardPlugin } from './ImageClipboardPlugin';
import { ImageDragDropPlugin } from './ImageDragDropPlugin';
import { $createImageNode, $selectImageNodeIfPresent, ImageNode } from './nodes/ImageNode';
import { getUserColor } from './user-colors';
import { presenceDotColor, presenceGradientCss } from './documentPresenceGradients';
import editorShell from './DocumentEditorShell.module.css';
import { PresenceActivityFeed } from './PresenceActivityFeed';
import type { DocumentEditorShellPresenceActivity } from './presenceActivityUtils';
export type { DocumentEditorShellPresenceActivity } from './presenceActivityUtils';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

type PersistStatus = 'idle' | 'saving' | 'saved' | 'error';
type ToolbarBlockType = 'paragraph' | 'h1' | 'h2' | 'ul' | 'ol';
const LOAD_ORIGIN = 'load';
const EDITOR_ORIGIN = 'editor';
const REMOTE_ORIGIN = 'remote';
const SYNC_FROM_YJS_TAG = 'sync-from-yjs';

const EDITOR_THEME = {
  text: {
    bold: 'flowdocs-text-bold',
    italic: 'flowdocs-text-italic',
    underline: 'flowdocs-text-underline',
    strikethrough: 'flowdocs-text-strikethrough',
  },
  heading: {
    h1: 'flowdocs-heading-h1',
    h2: 'flowdocs-heading-h2',
  },
  list: {
    ul: 'flowdocs-list-ul',
    ol: 'flowdocs-list-ol',
    listitem: 'flowdocs-list-item',
  },
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
}

interface DocumentMemberUpdatedEvent {
  documentId: string;
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

function tryApplySerializedLexicalState(
  editor: LexicalEditor,
  serialized: string,
): boolean {
  if (!isValidSerializedLexicalState(serialized)) {
    return false;
  }

  try {
    const parsed = extractSerializedLexicalRoot(serialized) as Parameters<
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

interface YjsLexicalBridgePluginProps {
  ydoc: Y.Doc;
  ytext: Y.Text;
  ylexicalState: Y.Map<string>;
  canEdit: boolean;
}

function YjsLexicalBridgePlugin({
  ydoc,
  ytext,
  ylexicalState,
  canEdit,
}: YjsLexicalBridgePluginProps) {
  const [editor] = useLexicalComposerContext();
  const lastAppliedSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    const syncFromYjs = (origin?: unknown) => {
      if (origin === EDITOR_ORIGIN) return;

      const serializedState = ylexicalState.get('serialized');
      if (
        typeof serializedState === 'string' &&
        serializedState.length > 0 &&
        serializedState !== lastAppliedSerializedRef.current &&
        tryApplySerializedLexicalState(editor, serializedState)
      ) {
        lastAppliedSerializedRef.current = serializedState;
        return;
      }

      const nextText = ytext.toString();
      const lexicalRecovery = recoverPlainTextFromLexicalSerialized(nextText);
      if (lexicalRecovery.isLexicalSerialized) {
        const recoveredText = lexicalRecovery.plainText;
        editor.update(
          () => {
            const currentText = readEditorText();
            if (currentText === recoveredText) return;
            writeEditorText(recoveredText);
          },
          { tag: SYNC_FROM_YJS_TAG },
        );

        if (nextText !== recoveredText && canEdit) {
          ydoc.transact(() => {
            replaceYTextValue(ytext, recoveredText);
          }, EDITOR_ORIGIN);
        }
        return;
      }

      editor.update(
        () => {
          const currentText = readEditorText();
          if (currentText === nextText) return;
          writeEditorText(nextText);
        },
        { tag: SYNC_FROM_YJS_TAG },
      );
    };

    syncFromYjs();
    const onTextObserve = (event: Y.YTextEvent) => {
      syncFromYjs(event.transaction.origin);
    };
    const onLexicalObserve = (event: Y.YMapEvent<string>) => {
      syncFromYjs(event.transaction.origin);
    };
    ytext.observe(onTextObserve);
    ylexicalState.observe(onLexicalObserve);

    return () => {
      ytext.unobserve(onTextObserve);
      ylexicalState.unobserve(onLexicalObserve);
    };
  }, [canEdit, editor, ydoc, ylexicalState, ytext]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, tags }) => {
      if (tags.has(SYNC_FROM_YJS_TAG)) return;
      if (!canEdit) return;

      const nextText = editorState.read(() => readEditorText());
      const nextSerialized = JSON.stringify(editorState.toJSON());

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
        return;
      }

      const isTextUnchanged = nextText === ytext.toString();
      const isSerializedUnchanged = ylexicalState.get('serialized') === nextSerialized;
      if (isTextUnchanged && isSerializedUnchanged) return;

      ydoc.transact(() => {
        replaceYTextValue(ytext, nextText);
        ylexicalState.set('serialized', nextSerialized);
      }, EDITOR_ORIGIN);
      lastAppliedSerializedRef.current = nextSerialized;
    });
  }, [canEdit, editor, ydoc, ylexicalState, ytext]);

  return null;
}

interface ToolbarButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarButton({ label, active, disabled, onClick }: ToolbarButtonProps) {
  return (
    <span className={editorShell.toolbarBtn}>
      <Button
        type="button"
        size="compact-xs"
        variant={active ? 'light' : 'subtle'}
        disabled={disabled}
        data-flowdocs-toolbar-active={active ? '' : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        styles={{
          root: {
            fontWeight: active ? 600 : 500,
            border: '1px solid transparent',
          },
        }}
      >
        {label}
      </Button>
    </span>
  );
}

interface EditorToolbarPluginProps {
  disabled: boolean;
  isUploadingImage: boolean;
  onUploadImage: (file: File) => Promise<{ url: string; altText: string } | null>;
  trailing?: ReactNode;
}

function EditorToolbarPlugin({
  disabled,
  isUploadingImage,
  onUploadImage,
  trailing,
}: EditorToolbarPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [blockType, setBlockType] = useState<ToolbarBlockType>('paragraph');
  const lastSelectionRef = useRef<RangeSelection | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          lastSelectionRef.current = selection.clone();
          setIsBold(selection.hasFormat('bold'));
          setIsItalic(selection.hasFormat('italic'));
          setIsUnderline(selection.hasFormat('underline'));
          setIsStrikethrough(selection.hasFormat('strikethrough'));

          const anchorNode = selection.anchor.getNode();
          const topLevel = anchorNode.getTopLevelElementOrThrow();
          if ($isHeadingNode(topLevel)) {
            const tag = topLevel.getTag();
            setBlockType(tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'paragraph');
            return;
          }

          if ($isListNode(topLevel)) {
            setBlockType(topLevel.getListType() === 'number' ? 'ol' : 'ul');
            return;
          }

          setBlockType('paragraph');
        });
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

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

  const formatText = (format: 'bold' | 'italic' | 'underline' | 'strikethrough') => {
    withSelection(() => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    });
  };

  const applyHeading = (tag: 'h1' | 'h2') => {
    withSelection((selection) => {
      $setBlocksType(selection, () => $createHeadingNode(tag));
    });
  };

  const applyParagraph = () => {
    withSelection((selection) => {
      $setBlocksType(selection, () => $createParagraphNode());
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
      $setBlocksType(selection, () => $createParagraphNode());
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
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
    if (next === 'ul') {
      applyList('ul');
      return;
    }
    if (next === 'ol') {
      applyList('ol');
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

  return (
    <div className={editorShell.toolbarInner}>
      <Group className={editorShell.toolbarControls} gap={6} wrap="nowrap" align="center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleImageFileSelected(e);
          }}
        />
        <Select
          className={editorShell.toolbarSelect}
          size="xs"
          w={158}
          disabled={disabled}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, zIndex: 500 }}
          value={blockType}
          onChange={handleBlockSelect}
          data={[
            { value: 'paragraph', label: 'Paragraph' },
            { value: 'h1', label: 'Heading 1' },
            { value: 'h2', label: 'Heading 2' },
            { value: 'ul', label: 'Bullet list' },
            { value: 'ol', label: 'Numbered list' },
          ]}
        />
        <ToolbarButton label="Bold" active={isBold} disabled={disabled} onClick={() => formatText('bold')} />
        <ToolbarButton label="Italic" active={isItalic} disabled={disabled} onClick={() => formatText('italic')} />
        <ToolbarButton
          label="Underline"
          active={isUnderline}
          disabled={disabled}
          onClick={() => formatText('underline')}
        />
        <ToolbarButton
          label="Strike"
          active={isStrikethrough}
          disabled={disabled}
          onClick={() => formatText('strikethrough')}
        />
        <ToolbarButton label="H1" active={blockType === 'h1'} disabled={disabled} onClick={() => applyHeading('h1')} />
        <ToolbarButton label="H2" active={blockType === 'h2'} disabled={disabled} onClick={() => applyHeading('h2')} />
        <ToolbarButton
          label="Bullet list"
          active={blockType === 'ul'}
          disabled={disabled}
          onClick={() => applyList('ul')}
        />
        <ToolbarButton
          label="Numbered list"
          active={blockType === 'ol'}
          disabled={disabled}
          onClick={() => applyList('ol')}
        />
        <ToolbarButton label="Undo" disabled={disabled} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} />
        <ToolbarButton label="Redo" disabled={disabled} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} />
        <ToolbarButton label="Clear formatting" disabled={disabled} onClick={clearFormatting} />
        <ToolbarButton
          label={isUploadingImage ? 'Uploading...' : 'Upload image'}
          disabled={disabled || isUploadingImage}
          onClick={handleUploadButton}
        />
      </Group>
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
}: DocumentEditorShellProps) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const authUser = useAuthStore((state) => state.user);
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const ytext = useMemo(() => ydoc.getText('content'), [ydoc]);
  const ylexicalState = useMemo(() => ydoc.getMap<string>('lexicalState'), [ydoc]);

  const [hydrated, setHydrated] = useState(false);
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

  const presenceLiveSourceRef = useRef({
    activeUsers: [] as ActiveUser[],
    remoteCursors: [] as RemoteCursor[],
  });

  const pending = useRef<Uint8Array[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const initialContentRef = useRef<unknown>(initialContent);

  useEffect(() => {
    initialContentRef.current = initialContent;
  }, [documentId, initialContent]);

  const lexicalInitialConfig = useMemo<InitialConfigType>(
    () => ({
      namespace: `flowdocs-document-${documentId}`,
      editable: canEdit,
      theme: EDITOR_THEME,
      nodes: [HeadingNode, ListNode, ListItemNode, ImageNode],
      onError(error: Error) {
        throw error;
      },
    }),
    [canEdit, documentId],
  );

  useEffect(() => {
    let cancelled = false;

    setHydrated(false);
    setLoadError(null);
    setPersistStatus('idle');
    setPersistMessage(null);
    setActiveUsers([]);
    setRemoteCursors([]);
    setRemoteCursorLayouts([]);

    void (async () => {
      try {
        const state = await fetchDocumentState(documentId);
        if (cancelled) return;

        const bytes = base64ToUint8(state.stateUpdateBase64);

        if (bytes.length > 0) {
          Y.applyUpdate(ydoc, bytes, LOAD_ORIGIN);
        }

        const persistedSerializedState =
          typeof state.editorStateJson === 'string' ? state.editorStateJson : '';
        const currentSerializedState = ylexicalState.get('serialized');
        if (
          (!currentSerializedState || currentSerializedState.trim().length === 0) &&
          persistedSerializedState.length > 0 &&
          isValidSerializedLexicalState(persistedSerializedState)
        ) {
          ydoc.transact(() => {
            ylexicalState.set('serialized', persistedSerializedState);
          }, LOAD_ORIGIN);
        }

        const serializedState = ylexicalState.get('serialized');
        const hasLexicalSerializedState =
          typeof serializedState === 'string' &&
          serializedState.length > 0 &&
          isValidSerializedLexicalState(serializedState);

        if (!hasLexicalSerializedState && ytext.toString().length === 0) {
          const fallbackText = normalizeFallbackPlainText(initialContentRef.current);
          if (fallbackText.length > 0) {
            ydoc.transact(() => {
              replaceYTextValue(ytext, fallbackText);
            }, LOAD_ORIGIN);
          }
        }

        if (cancelled) return;
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

  const flushPending = useCallback(async () => {
    if (pending.current.length === 0) return;

    const merged = mergePendingUpdates(pending.current);
    pending.current = [];

    setPersistStatus('saving');
    setPersistMessage(null);

    try {
      const serializedState = ylexicalState.get('serialized');
      const normalizedSerializedState =
        typeof serializedState === 'string' &&
        serializedState.length > 0 &&
        isValidSerializedLexicalState(serializedState)
          ? serializedState
          : undefined;

      await postDocumentUpdate(documentId, {
        updateBase64: uint8ToBase64(merged),
        sourceClientId: String(ydoc.clientID),
        ...(normalizedSerializedState
          ? { editorStateJson: normalizedSerializedState }
          : {}),
      });

      setPersistStatus('saved');
    } catch (err) {
      setPersistStatus('error');
      setPersistMessage(getApiErrorMessage(err));
    }
  }, [documentId, ydoc, ylexicalState]);

  useEffect(() => {
    const onUpdate = (update: Uint8Array, origin: unknown) => {
      setOverlayRevision((v) => v + 1);
      if (origin === LOAD_ORIGIN || origin === REMOTE_ORIGIN) return;
      if (!canEdit) return;

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

      void flushPending();
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
      console.log('[realtime] document_update:', event);

      if (event.documentId !== documentId) return;
      if (
        event.sourceClientId &&
        event.sourceClientId === String(ydoc.clientID)
      ) {
        console.log('[realtime] ignored own update');
        return;
      }

      try {
        const bytes = base64ToUint8(event.updateBase64);
        if (bytes.length === 0) return;
        Y.applyUpdate(ydoc, bytes, REMOTE_ORIGIN);
      } catch {
        console.warn('[realtime] ignored malformed realtime payload');
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
      socketRef.current = null;
      socket.disconnect();
    };
  }, [accessToken, authUser?.id, documentId, queryClient, ydoc]);

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

  if (!hydrated) {
    return (
      <Text size="sm" style={{ color: '#6b6f85' }}>
        Loading document state...
      </Text>
    );
  }

  return (
    <Box className={editorShell.root}>
      <LexicalComposer
        key={`${documentId}-${canEdit ? 'edit' : 'view'}`}
        initialConfig={lexicalInitialConfig}
      >
        <DocumentEditorCapabilitiesProvider canEdit={canEdit}>
          <Box className={editorShell.workspaceInner}>
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
                  onClick={onShareClick}
                  disabled={shareDisabled}
                >
                  Paylaş
                </Button>
              </Group>
            </Box>

            {persistMessage ? (
              <Box px="md" py={6} style={{ background: 'rgba(185, 28, 28, 0.12)' }}>
                <Text size="xs" c="red">
                  {persistMessage}
                </Text>
              </Box>
            ) : null}

            <div className={editorShell.toolbarStrip}>
              <EditorToolbarPlugin
                disabled={!canEdit}
                isUploadingImage={isUploadingImage}
                onUploadImage={handleUploadImage}
                trailing={syncToolbarTrailing}
              />
            </div>

            <div className={editorShell.bodyThreeCol}>
              <aside className={editorShell.leftOutline}>
                <div className={editorShell.outlineHeader}>İÇİNDEKİLER</div>
                <nav className={editorShell.outlineNav} aria-label="İçindekiler" />
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
                      </div>
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

              <aside className={editorShell.rightRail}>
                <Tabs
                  defaultValue="users"
                  className={editorShell.railTabs}
                  keepMounted={false}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                >
                  <Tabs.List grow>
                    <Tabs.Tab value="users">Kullanıcılar</Tabs.Tab>
                    <Tabs.Tab value="comments">Yorumlar</Tabs.Tab>
                    <Tabs.Tab value="ws">WS Log</Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel value="users" pt={0} className={editorShell.railPanel}>
                    <ScrollArea
                      h="100%"
                      scrollbarSize={6}
                      type="auto"
                      classNames={{ root: editorShell.railUsersScroll, viewport: editorShell.railUsersViewport }}
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
                                        boxShadow: `0 0 8px ${dot}`,
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
                    <ScrollArea h="100%" scrollbarSize={6} type="auto">
                      <Box className={editorShell.commentsTabBody}>
                        {commentsPanel ?? (
                          <Text size="sm" className={editorShell.muted}>
                            Yorumlar bu sekmede gösterilecek.
                          </Text>
                        )}
                      </Box>
                    </ScrollArea>
                  </Tabs.Panel>
                  <Tabs.Panel value="ws" pt={0} className={editorShell.railPanel}>
                    <div className={editorShell.wsLogPlaceholder}>
                      WebSocket olay günlüğü burada listelenecek (yakında).
                    </div>
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
            />
            <CommentSelectionCapturePlugin documentId={documentId} />
            <ImageClipboardPlugin />
            <ImageDragDropPlugin />

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
