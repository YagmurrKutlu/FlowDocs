import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { $findMatchingParent } from '@lexical/utils';
import {
  $getNearestNodeFromDOMNode,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  type LexicalEditor,
  type RangeSelection,
} from 'lexical';

const BLOCKED_PROTOCOL = /^(javascript|data|vbscript|file):/i;

/** Normalize and validate URL; returns null when unsafe or empty. */
export function openLinkInNewTab(raw: string): boolean {
  const safe = sanitizeLinkUrl(raw);
  if (!safe) return false;
  window.open(safe, '_blank', 'noopener,noreferrer');
  return true;
}

export function readSafeUrlFromAnchor(anchor: HTMLAnchorElement): string | null {
  return sanitizeLinkUrl(anchor.getAttribute('href') ?? '');
}

export function findLinkAnchorElement(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const anchor = target.closest('a.flowdocs-link');
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

/** Select the LinkNode matching a DOM anchor so edit/remove commands apply correctly. */
export function selectLinkFromDom(
  editor: LexicalEditor,
  anchor: HTMLAnchorElement,
): RangeSelection | null {
  let stored: RangeSelection | null = null;
  editor.update(() => {
    const nearest = $getNearestNodeFromDOMNode(anchor);
    if (!nearest) return;

    const linkNode = $isLinkNode(nearest)
      ? nearest
      : $findMatchingParent(nearest, $isLinkNode);

    if (!linkNode || !$isLinkNode(linkNode)) return;

    linkNode.select(0, linkNode.getChildrenSize());
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      stored = selection.clone();
    }
  });
  return stored;
}

export function sanitizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  if (BLOCKED_PROTOCOL.test(candidate)) {
    return null;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

export function readLinkFromSelection(): {
  url: string | null;
  hasNonCollapsedSelection: boolean;
} {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return { url: null, hasNonCollapsedSelection: false };
  }

  const linkNode = $findMatchingParent(selection.anchor.getNode(), $isLinkNode);
  const url =
    linkNode !== null && $isLinkNode(linkNode) ? linkNode.getURL() : null;

  return {
    url,
    hasNonCollapsedSelection: !selection.isCollapsed(),
  };
}

export function selectionIsInsideLink(): boolean {
  return readLinkFromSelection().url !== null;
}

export function applyLinkInEditor(
  editor: LexicalEditor,
  url: string,
  lastSelection: RangeSelection | null,
): boolean {
  const sanitized = sanitizeLinkUrl(url);
  if (!sanitized) return false;

  let applied = false;
  editor.focus();
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection) && lastSelection) {
      $setSelection(lastSelection.clone());
      selection = $getSelection();
    }
    if (!$isRangeSelection(selection)) return;

    const { url: existingUrl, hasNonCollapsedSelection } = readLinkFromSelection();
    if (selection.isCollapsed() && !existingUrl && !hasNonCollapsedSelection) {
      return;
    }

    editor.dispatchCommand(TOGGLE_LINK_COMMAND, sanitized);
    applied = true;
  });
  return applied;
}

export function removeLinkInEditor(
  editor: LexicalEditor,
  lastSelection: RangeSelection | null,
): void {
  editor.focus();
  editor.update(() => {
    let selection = $getSelection();
    if (!$isRangeSelection(selection) && lastSelection) {
      $setSelection(lastSelection.clone());
      selection = $getSelection();
    }
    if (!$isRangeSelection(selection)) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  });
}
