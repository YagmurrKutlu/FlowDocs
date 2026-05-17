import { $isHeadingNode } from '@lexical/rich-text';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $getRoot } from 'lexical';

export type OutlineHeadingLevel = 1 | 2 | 3;

export interface DocumentOutlineEntry {
  key: string;
  level: OutlineHeadingLevel;
  text: string;
}

const HEADING_TAG_LEVEL: Record<string, OutlineHeadingLevel> = {
  h1: 1,
  h2: 2,
  h3: 3,
};

/** Top-level H1–H3 blocks in document order (standard TOC). */
export function extractDocumentOutline(): DocumentOutlineEntry[] {
  const entries: DocumentOutlineEntry[] = [];

  for (const node of $getRoot().getChildren()) {
    if (!$isHeadingNode(node)) continue;

    const level = HEADING_TAG_LEVEL[node.getTag()];
    if (!level) continue;

    entries.push({
      key: node.getKey(),
      level,
      text: node.getTextContent().replace(/\s+/g, ' ').trim(),
    });
  }

  return entries;
}

export function outlinesEqual(
  a: DocumentOutlineEntry[],
  b: DocumentOutlineEntry[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    if (!other) return false;
    return item.key === other.key && item.level === other.level && item.text === other.text;
  });
}

export function scrollToOutlineHeading(
  editor: LexicalEditor,
  key: string,
  scrollContainer?: HTMLElement | null,
): void {
  const dom = editor.getElementByKey(key);
  if (!dom) return;

  if (scrollContainer) {
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = dom.getBoundingClientRect();
    const top = targetRect.top - containerRect.top + scrollContainer.scrollTop - 20;
    scrollContainer.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  editor.update(() => {
    const node = $getNodeByKey(key);
    if (node != null && $isHeadingNode(node)) {
      node.selectStart();
    }
  });
}
