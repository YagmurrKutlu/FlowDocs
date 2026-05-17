import type { LexicalEditor } from 'lexical';
import {
  $createNodeSelection,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  type NodeKey,
} from 'lexical';
import {
  logActiveAttachmentKeyCleared,
  logFileAttachmentSelected,
  logFileAttachmentSelectionPersisted,
} from './fileAttachmentUtils';
import { $isFileAttachmentNode, type FileAttachmentNode } from './nodes/FileAttachmentNode';

export const FILE_ATTACHMENT_SELECTION_GUARD_TAG = 'file-attachment-selection-guard';

type Listener = () => void;

let activeAttachmentKey: NodeKey | null = null;
const listeners = new Set<Listener>();

export function getActiveFileAttachmentKey(): NodeKey | null {
  return activeAttachmentKey;
}

export function setActiveFileAttachmentKey(key: NodeKey | null): void {
  if (activeAttachmentKey === key) return;
  activeAttachmentKey = key;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeActiveFileAttachmentKey(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isFileAttachmentActionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.flowdocs-file-attachment-select-handle')) return false;
  if (target.closest('.flowdocs-file-attachment__actions')) return true;
  const headerButton = target.closest('.flowdocs-file-attachment-preview__header button');
  if (headerButton && !headerButton.classList.contains('flowdocs-file-attachment-select-handle')) {
    return true;
  }
  return false;
}

export function isInsideFileAttachmentBlock(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('[data-flowdocs-file-attachment]') ||
      target.closest('[data-flowdocs-file-attachment-toolbar]'),
  );
}

export function isFileAttachmentToolbarPointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-flowdocs-file-attachment-toolbar]'));
}

export function isFileAttachmentCardPointerTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-flowdocs-file-attachment]'));
}

export function readSelectionFileAttachmentKey(): NodeKey | null {
  const selection = $getSelection();
  if (!$isNodeSelection(selection) || selection.getNodes().length !== 1) {
    return null;
  }
  const node = selection.getNodes()[0];
  return $isFileAttachmentNode(node) ? node.getKey() : null;
}

export function readDomSelectedFileAttachmentKey(editor: LexicalEditor): NodeKey | null {
  const root = editor.getRootElement();
  if (!root) return null;

  const selectedWrap = root.querySelector(
    '[data-flowdocs-file-attachment-selected="true"]',
  );
  if (selectedWrap instanceof HTMLElement) {
    const key = selectedWrap.getAttribute('data-flowdocs-file-attachment-key');
    if (key) return key;
  }

  const activeKey = getActiveFileAttachmentKey();
  if (activeKey) {
    const activeEl = root.querySelector(
      `[data-flowdocs-file-attachment-key="${CSS.escape(activeKey)}"]`,
    );
    if (activeEl instanceof HTMLElement) {
      return activeKey;
    }
  }

  return null;
}

export type FileAttachmentResolveContext = {
  toolbarNodeKey: NodeKey | null;
  activeAttachmentKey: NodeKey | null;
};

export function $resolveCurrentFileAttachmentForAction(
  editor: LexicalEditor,
  context: FileAttachmentResolveContext,
): { node: FileAttachmentNode; nodeKey: NodeKey } | null {
  const selectionKey = readSelectionFileAttachmentKey();
  const domSelectedKey = readDomSelectedFileAttachmentKey(editor);

  const candidateKeys: (NodeKey | null)[] = [
    context.toolbarNodeKey,
    context.activeAttachmentKey,
    getActiveFileAttachmentKey(),
    selectionKey,
    domSelectedKey,
  ];

  const seen = new Set<string>();
  for (const key of candidateKeys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const node = $getNodeByKey(key);
    if ($isFileAttachmentNode(node)) {
      return { node, nodeKey: key };
    }
  }

  return null;
}

export function collectFileAttachmentResolveKeys(
  editor: LexicalEditor,
  context: FileAttachmentResolveContext,
): {
  toolbarNodeKey: NodeKey | null;
  activeAttachmentKey: NodeKey | null;
  selectionKey: NodeKey | null;
  domSelectedKey: NodeKey | null;
} {
  return {
    toolbarNodeKey: context.toolbarNodeKey,
    activeAttachmentKey: context.activeAttachmentKey ?? getActiveFileAttachmentKey(),
    selectionKey: readSelectionFileAttachmentKey(),
    domSelectedKey: readDomSelectedFileAttachmentKey(editor),
  };
}

export function $selectFileAttachmentNode(key: NodeKey): boolean {
  const node = $getNodeByKey(key);
  if (!$isFileAttachmentNode(node)) return false;
  const selection = $createNodeSelection();
  selection.add(key);
  $setSelection(selection);
  return true;
}

export function persistFileAttachmentSelection(editor: LexicalEditor, nodeKey: NodeKey): void {
  setActiveFileAttachmentKey(nodeKey);
  editor.update(() => {
    $selectFileAttachmentNode(nodeKey);
    logFileAttachmentSelected(nodeKey);
  });
  scheduleFileAttachmentSelectionRestore(editor, nodeKey, { force: true });
}

export function scheduleFileAttachmentSelectionRestore(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  options?: { force?: boolean; toolbarAction?: boolean },
): void {
  if (!options?.force && !options?.toolbarAction) {
    return;
  }
  if (options.toolbarAction && getActiveFileAttachmentKey() === null) {
    return;
  }
  setActiveFileAttachmentKey(nodeKey);
  queueMicrotask(() => {
    if (getActiveFileAttachmentKey() !== nodeKey) return;
    editor.update(
      () => {
        if (getActiveFileAttachmentKey() !== nodeKey) return;
        const current = $getSelection();
        if ($isRangeSelection(current)) return;
        if ($isNodeSelection(current) && current.has(nodeKey)) {
          logFileAttachmentSelectionPersisted(nodeKey);
          return;
        }
        if ($selectFileAttachmentNode(nodeKey)) {
          logFileAttachmentSelectionPersisted(nodeKey);
        }
      },
      { tag: FILE_ATTACHMENT_SELECTION_GUARD_TAG },
    );
  });
}

export function shouldDismissFileAttachmentToolbar(): boolean {
  const activeKey = getActiveFileAttachmentKey();
  if (!activeKey) return false;

  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    return true;
  }
  if ($isNodeSelection(selection)) {
    const nodes = selection.getNodes();
    if (nodes.length === 1 && $isFileAttachmentNode(nodes[0]) && nodes[0].getKey() === activeKey) {
      return false;
    }
    return true;
  }
  return false;
}

export function clearFileAttachmentSelection(editor: LexicalEditor): void {
  if (!getActiveFileAttachmentKey()) return;
  setActiveFileAttachmentKey(null);
  logActiveAttachmentKeyCleared();
  editor.update(() => {
    const selection = $getSelection();
    if (!$isNodeSelection(selection)) return;
    if (selection.getNodes().some((node) => $isFileAttachmentNode(node))) {
      $setSelection(null);
    }
  });
}
