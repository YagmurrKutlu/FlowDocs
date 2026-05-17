import type { LexicalEditor } from 'lexical';
import {
  $createNodeSelection,
  $getNodeByKey,
  $setSelection,
  type NodeKey,
} from 'lexical';
import { setActiveFileAttachmentKey } from './fileAttachmentSelection';
import { logMoveAttachment } from './fileAttachmentUtils';
import { $isFileAttachmentNode, type FileAttachmentNode } from './nodes/FileAttachmentNode';

export type FileAttachmentLayoutAlign = 'left' | 'center' | 'right';
export type FileAttachmentWidthPreset = 'narrow' | 'normal' | 'wide' | 'full';
export type FileAttachmentMoveDirection = 'up' | 'down';

export const FILE_ATTACHMENT_ALIGN_CLASSES = [
  'flowdocs-file-attachment-align-left',
  'flowdocs-file-attachment-align-center',
  'flowdocs-file-attachment-align-right',
] as const;

export const FILE_ATTACHMENT_LAYOUT_UPDATE_TAG = 'file-attachment-layout-update';

export const FILE_ATTACHMENT_WIDTH_CLASSES = [
  'flowdocs-file-attachment-width-narrow',
  'flowdocs-file-attachment-width-normal',
  'flowdocs-file-attachment-width-wide',
  'flowdocs-file-attachment-width-full',
] as const;

export function sanitizeFileAttachmentAlign(value: unknown): FileAttachmentLayoutAlign {
  if (value === 'center' || value === 'right') return value;
  return 'left';
}

export function sanitizeFileAttachmentWidthPreset(
  value: unknown,
): FileAttachmentWidthPreset {
  if (value === 'narrow' || value === 'wide' || value === 'full') return value;
  return 'normal';
}

export function applyFileAttachmentLayoutClasses(
  element: HTMLElement,
  layoutAlign: FileAttachmentLayoutAlign,
  widthPreset: FileAttachmentWidthPreset,
): void {
  element.classList.remove(...FILE_ATTACHMENT_ALIGN_CLASSES, ...FILE_ATTACHMENT_WIDTH_CLASSES);
  element.classList.add(`flowdocs-file-attachment-align-${layoutAlign}`);
  element.classList.add(`flowdocs-file-attachment-width-${widthPreset}`);
  element.dataset.flowdocsFileAttachmentAlign = layoutAlign;
  element.dataset.flowdocsFileAttachmentWidth = widthPreset;
}

export function syncFileAttachmentLayoutDom(
  editor: LexicalEditor,
  nodeKey: NodeKey,
  layoutAlign: FileAttachmentLayoutAlign,
  widthPreset: FileAttachmentWidthPreset,
): string | null {
  const root = editor.getElementByKey(nodeKey);
  if (!root) return null;
  applyFileAttachmentLayoutClasses(root, layoutAlign, widthPreset);
  const wrap = root.querySelector('.flowdocs-file-attachment-wrap');
  if (wrap instanceof HTMLElement) {
    applyFileAttachmentLayoutClasses(wrap, layoutAlign, widthPreset);
    return wrap.className;
  }
  return root.className;
}

export function resolveFileAttachmentWrapElement(
  editor: LexicalEditor,
  nodeKey: NodeKey,
): HTMLElement | null {
  const root = editor.getElementByKey(nodeKey);
  if (!root) return null;
  const inner = root.querySelector('.flowdocs-file-attachment-wrap');
  if (inner instanceof HTMLElement) {
    return inner;
  }
  if (root.classList.contains('flowdocs-file-attachment-wrap')) {
    return root;
  }
  return root;
}

export function $resolveFileAttachmentNode(
  nodeKey: NodeKey | null | undefined,
): FileAttachmentNode | null {
  if (!nodeKey) return null;
  const node = $getNodeByKey(nodeKey);
  return $isFileAttachmentNode(node) ? node : null;
}

export function getFileAttachmentWrapClassName(
  align: FileAttachmentLayoutAlign,
  widthPreset: FileAttachmentWidthPreset,
  extra?: string,
): string {
  return [
    'flowdocs-file-attachment-wrap',
    `flowdocs-file-attachment-align-${align}`,
    `flowdocs-file-attachment-width-${widthPreset}`,
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export function $canMoveFileAttachment(
  node: FileAttachmentNode,
  direction: FileAttachmentMoveDirection,
): boolean {
  return direction === 'up'
    ? node.getPreviousSibling() !== null
    : node.getNextSibling() !== null;
}

export function $moveFileAttachment(
  node: FileAttachmentNode,
  direction: FileAttachmentMoveDirection,
): boolean {
  const sibling =
    direction === 'up' ? node.getPreviousSibling() : node.getNextSibling();
  if (!sibling) return false;

  const nodeKey = node.getKey();
  if (direction === 'up') {
    sibling.insertBefore(node);
  } else {
    sibling.insertAfter(node);
  }

  const selection = $createNodeSelection();
  selection.add(nodeKey);
  $setSelection(selection);
  setActiveFileAttachmentKey(nodeKey);
  logMoveAttachment(direction, true);
  return true;
}

export function $patchFileAttachmentLayout(
  node: FileAttachmentNode,
  patch: {
    layoutAlign?: FileAttachmentLayoutAlign;
    widthPreset?: FileAttachmentWidthPreset;
  },
): FileAttachmentNode {
  const writable = node.getWritable();
  if (patch.layoutAlign !== undefined) {
    writable.__align = sanitizeFileAttachmentAlign(patch.layoutAlign);
  }
  if (patch.widthPreset !== undefined) {
    writable.__widthPreset = sanitizeFileAttachmentWidthPreset(patch.widthPreset);
  }
  writable.markDirty();
  return writable;
}

export function $restoreFileAttachmentNodeSelection(nodeKey: NodeKey): void {
  const selection = $createNodeSelection();
  selection.add(nodeKey);
  $setSelection(selection);
  setActiveFileAttachmentKey(nodeKey);
}
